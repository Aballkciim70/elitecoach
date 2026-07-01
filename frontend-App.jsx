import React, { useState, useEffect, useContext, createContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

const AuthContext = createContext();
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) localStorage.setItem('token', token);
  }, [token]);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        setUser(data.user);
        return { success: true };
      }
      return { success: false, error: data.error };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
  };

  const register = async (name, email, password) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        setUser(data.user);
        return { success: true };
      }
      return { success: false, error: data.error };
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, register, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

function LoginScreen() {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('client@example.com');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(email, password);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }
  };

  return (
    <div style={styles.authContainer}>
      <div style={styles.authBox}>
        <h1 style={styles.logo}>EliteCoach</h1>
        <p style={styles.tagline}>Coaching Fitness avec IA</p>
        {error && <div style={styles.errorBox}>{error}</div>}
        <form onSubmit={handleSubmit} style={styles.form}>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={styles.input} />
          <input type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} style={styles.input} />
          <button type="submit" style={styles.btn}>Se connecter</button>
        </form>
        <div style={styles.demoSection}>
          <p style={styles.demoTitle}>Comptes de test:</p>
          <button onClick={() => { setEmail('client@example.com'); setPassword('password'); }} style={styles.demoBtn}>👤 Client</button>
          <button onClick={() => { setEmail('coach@example.com'); setPassword('password'); }} style={styles.demoBtn}>🏆 Coach</button>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <Header title="Dashboard" />
      <div style={styles.content}>
        <h2>Bienvenue, {user?.name}! 👋</h2>
        <div style={styles.statsGrid}>
          <StatCard label="Série" value="5 jours" />
          <StatCard label="Entraînements" value="12" />
          <StatCard label="Objectif" value={user?.objective || 'À définir'} />
          <StatCard label="Niveau" value={user?.experience || 'Débutant'} />
        </div>
        <button onClick={() => navigate('/workout')} style={styles.ctaBtn}>🚀 Mon plan d'entraînement</button>
        <div style={styles.cardsGrid}>
          <Card title="📊 Progression" desc="Voir mon historique" onClick={() => navigate('/progress')} />
          <Card title="💬 Coach IA" desc="Chat 24/7" onClick={() => navigate('/coach')} />
          <Card title="👤 Profil" desc="Mes infos" onClick={() => navigate('/profile')} />
        </div>
      </div>
    </div>
  );
}

function WorkoutScreen() {
  const navigate = useNavigate();
  const { token } = useContext(AuthContext);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);

  const generatePlan = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/workout/generate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setPlan(data.plan);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <Header title="Entraînement" onBack={() => navigate('/dashboard')} />
      <div style={styles.content}>
        <h2>Ton plan d'entraînement</h2>
        {!plan && <button onClick={generatePlan} style={styles.ctaBtn}>{loading ? '⏳ Génération...' : '🚀 Générer mon plan'}</button>}
        {plan && Object.entries(plan.plan).map(([day, details]) => (
          <div key={day} style={styles.card}>
            <h3>{day}</h3>
            {details.exercises?.map((ex, idx) => (
              <div key={idx} style={styles.exerciseItem}>
                <p><strong>{ex.name}</strong></p>
                <p style={styles.smallText}>{ex.sets} séries x {ex.reps}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressScreen() {
  const navigate = useNavigate();
  const [history] = useState([
    { date: '2024-01-15', duration: 60, exercises: 8 },
    { date: '2024-01-14', duration: 55, exercises: 7 }
  ]);

  return (
    <div style={styles.container}>
      <Header title="Progression" onBack={() => navigate('/dashboard')} />
      <div style={styles.content}>
        <h2>Ton historique</h2>
        {history.map((h, idx) => (
          <div key={idx} style={styles.card}>
            <p><strong>{h.date}</strong></p>
            <p style={styles.smallText}>{h.duration}min • {h.exercises} exos</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CoachScreen() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Salut! 👋 Je suis ton coach IA. Pose-moi tes questions!' }
  ]);
  const [input, setInput] = useState('');

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages([...messages, { role: 'user', text: input }]);
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'bot', text: '💪 Bonne question! Je recommande...' }]);
    }, 800);
    setInput('');
  };

  return (
    <div style={styles.container}>
      <Header title="Coach IA" onBack={() => navigate('/dashboard')} />
      <div style={styles.chatContainer}>
        <div style={styles.messagesBox}>
          {messages.map((msg, idx) => (
            <div key={idx} style={{ ...styles.messageItem, ...(msg.role === 'user' ? styles.userMsg : styles.botMsg) }}>
              {msg.text}
            </div>
          ))}
        </div>
        <div style={styles.inputBox}>
          <input type="text" placeholder="Pose une question..." value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && sendMessage()} style={styles.inputField} />
          <button onClick={sendMessage} style={styles.sendBtn}>📤</button>
        </div>
      </div>
    </div>
  );
}

function ProfileScreen() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <Header title="Profil" onBack={() => navigate('/dashboard')} />
      <div style={styles.content}>
        <h2>Mon Profil</h2>
        <div style={styles.card}>
          <p><strong>Nom:</strong> {user?.name}</p>
          <p><strong>Email:</strong> {user?.email}</p>
          <p><strong>Rôle:</strong> {user?.role}</p>
        </div>
        <button onClick={() => { logout(); navigate('/'); }} style={{...styles.ctaBtn, backgroundColor: '#EF4444'}}>🚪 Déconnexion</button>
      </div>
    </div>
  );
}

function Header({ title, onBack }) {
  return (
    <div style={styles.header}>
      <div style={styles.headerContent}>
        {onBack ? <button onClick={onBack} style={styles.headerBtn}>← Retour</button> : <div style={{ width: 40 }}></div>}
        <h1 style={styles.title}>{title}</h1>
        <div style={{ width: 40 }}></div>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={styles.statCard}>
      <span style={styles.statValue}>{value}</span>
      <p style={styles.statLabel}>{label}</p>
    </div>
  );
}

function Card({ title, desc, onClick }) {
  return (
    <div style={styles.card} onClick={onClick}>
      <h3>{title}</h3>
      <p style={styles.smallText}>{desc}</p>
    </div>
  );
}

function AppRoutes() {
  const { user, token } = useContext(AuthContext);

  if (!token) return <LoginScreen />;

  return (
    <Routes>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/workout" element={<WorkoutScreen />} />
      <Route path="/progress" element={<ProgressScreen />} />
      <Route path="/coach" element={<CoachScreen />} />
      <Route path="/profile" element={<ProfileScreen />} />
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0F172A', color: '#E2E8F0' },
  content: { flex: 1, overflow: 'auto', padding: 20, maxWidth: 1000, margin: '0 auto' },
  header: { backgroundColor: '#1E293B', borderBottom: '1px solid #334155' },
  headerContent: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' },
  headerBtn: { background: 'none', border: 'none', color: '#3B82F6', cursor: 'pointer', fontSize: 20 },
  title: { fontSize: 20, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  authContainer: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' },
  authBox: { width: '100%', maxWidth: 400, padding: 32, backgroundColor: '#1E293B', borderRadius: 12, border: '1px solid #334155' },
  logo: { fontSize: 36, fontWeight: 'bold', color: '#3B82F6', marginBottom: 8 },
  tagline: { color: '#94A3B8', marginBottom: 24 },
  form: { display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 },
  input: { padding: '12px', backgroundColor: '#0F172A', border: '1px solid #334155', borderRadius: 6, color: '#E2E8F0' },
  btn: { padding: '12px', backgroundColor: '#3B82F6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' },
  errorBox: { padding: 12, backgroundColor: '#EF4444', color: 'white', borderRadius: 6, marginBottom: 16 },
  demoSection: { marginTop: 20, paddingTop: 20, borderTop: '1px solid #334155' },
  demoTitle: { fontSize: 12, color: '#94A3B8', marginBottom: 8 },
  demoBtn: { width: '100%', padding: '8px', margin: '4px 0', backgroundColor: '#334155', color: '#E2E8F0', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
  ctaBtn: { width: '100%', padding: '16px', backgroundColor: '#3B82F6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', marginTop: 20, marginBottom: 20 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 12, marginBottom: 24 },
  statCard: { backgroundColor: '#1E293B', borderRadius: 8, padding: 16, border: '1px solid #334155', textAlign: 'center' },
  statValue: { fontSize: 28, fontWeight: 'bold', display: 'block', marginBottom: 8 },
  statLabel: { fontSize: 12, color: '#94A3B8' },
  cardsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 },
  card: { backgroundColor: '#1E293B', borderRadius: 8, padding: 16, border: '1px solid #334155', cursor: 'pointer' },
  exerciseItem: { paddingTop: 12, borderTop: '1px solid #334155', marginTop: 12 },
  smallText: { fontSize: 12, color: '#94A3B8' },
  chatContainer: { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)', padding: 20 },
  messagesBox: { flex: 1, overflowY: 'auto', marginBottom: 12 },
  messageItem: { marginBottom: 12, padding: 12, borderRadius: 8, maxWidth: '80%' },
  userMsg: { backgroundColor: '#3B82F6', marginLeft: 'auto' },
  botMsg: { backgroundColor: '#1E293B', border: '1px solid #334155' },
  inputBox: { display: 'flex', gap: 8 },
  inputField: { flex: 1, padding: '12px', backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 6, color: '#E2E8F0' },
  sendBtn: { padding: '12px 16px', backgroundColor: '#3B82F6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }
};

export default App;
