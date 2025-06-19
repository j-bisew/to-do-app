import React, { useState, useEffect } from 'react';
import Keycloak from 'keycloak-js';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Keycloak configuration
const keycloakConfig = {
  url: process.env.REACT_APP_KEYCLOAK_URL || 'http://localhost:8080',
  realm: process.env.REACT_APP_KEYCLOAK_REALM || 'todo-realm',
  clientId: process.env.REACT_APP_KEYCLOAK_CLIENT_ID || 'todo-frontend'
};

// Initialize Keycloak
const keycloak = new Keycloak(keycloakConfig);

function App() {
  const [user, setUser] = useState(null);
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('medium');
  const [keycloakInitialized, setKeycloakInitialized] = useState(false);
  const [authMethod, setAuthMethod] = useState('legacy'); // 'keycloak' or 'legacy'
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminData, setAdminData] = useState({ users: [], stats: {} });
  
  // Legacy auth states
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('demo123');
  const [registerMode, setRegisterMode] = useState(false);
  const [username, setUsername] = useState('');

  // Initialize Keycloak on startup
  useEffect(() => {
    const initKeycloak = async () => {
      try {
        const authenticated = await keycloak.init({
          onLoad: 'check-sso',
          silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
          pkceMethod: 'S256'
        });

        setKeycloakInitialized(true);

        if (authenticated) {
          console.log('✅ Keycloak authenticated');
          setAuthMethod('keycloak');
          await loadKeycloakUser();
          await fetchTodos();
        } else {
          console.log('🔓 Not authenticated with Keycloak, trying legacy auth');
          tryLegacyAuth();
        }
      } catch (error) {
        console.warn('⚠️ Keycloak initialization failed:', error);
        setKeycloakInitialized(true);
        tryLegacyAuth();
      }
    };

    initKeycloak();
  }, []);

  const tryLegacyAuth = () => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
      setAuthMethod('legacy');
      fetchTodos();
    }
  };

  const loadKeycloakUser = async () => {
    try {
      const userProfile = await keycloak.loadUserProfile();
      const roles = keycloak.realmAccess?.roles || [];
      
      setUser({
        id: keycloak.subject,
        username: userProfile.username,
        email: userProfile.email,
        firstName: userProfile.firstName,
        lastName: userProfile.lastName,
        roles: roles,
        isAdmin: roles.includes('admin')
      });
    } catch (error) {
      console.error('Failed to load user profile:', error);
    }
  };

  // Keycloak login
  const loginWithKeycloak = () => {
    keycloak.login({
      redirectUri: window.location.origin
    });
  };

  // Legacy login
  const legacyLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      
      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser({ ...data.user, isAdmin: data.user.role === 'admin' });
        setAuthMethod('legacy');
        setMessage('Logged in successfully!');
        fetchTodos();
      } else {
        setMessage('Error: ' + data.error);
      }
    } catch (error) {
      setMessage('Connection error. Is backend running?');
    }
    setLoading(false);
  };

  // Legacy register
  const legacyRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser({ ...data.user, isAdmin: false });
        setAuthMethod('legacy');
        setMessage('Registered successfully!');
        fetchTodos();
      } else {
        setMessage('Error: ' + data.error);
      }
    } catch (error) {
      setMessage('Connection error.');
    }
    setLoading(false);
  };

  // Logout
  const logout = () => {
    if (authMethod === 'keycloak') {
      keycloak.logout({
        redirectUri: window.location.origin
      });
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setTodos([]);
      setMessage('Logged out');
    }
  };

  // Get auth headers with token refresh
  const getAuthHeaders = async () => {
    console.log('🔍 getAuthHeaders - authMethod:', authMethod);
    console.log('🔍 keycloak.authenticated:', keycloak.authenticated);
    console.log('🔍 keycloak.token exists:', !!keycloak.token);
    
    if (authMethod === 'keycloak' && keycloak.authenticated) {
      // Refresh token if it expires soon (within 30 seconds)
      try {
        await keycloak.updateToken(30);
        console.log('✅ Token refreshed, token:', keycloak.token ? 'EXISTS' : 'NULL');
        return { 'Authorization': `Bearer ${keycloak.token}` };
      } catch (error) {
        console.error('❌ Failed to refresh token:', error);
        // Token refresh failed, redirect to login
        keycloak.login();
        return {};
      }
    } else if (authMethod === 'legacy') {
      const token = localStorage.getItem('token');
      console.log('🔍 Legacy token:', token ? 'EXISTS' : 'NULL');
      return token ? { 'Authorization': `Bearer ${token}` } : {};
    } else {
      console.log('❌ No valid auth method');
      return {};
    }
  };

  // Fetch todos
  const fetchTodos = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/api/todos`, {
        headers
      });

      if (response.ok) {
        const data = await response.json();
        setTodos(Array.isArray(data) ? data : data.todos || []);
      } else {
        setMessage('Failed to load todos');
      }
    } catch (error) {
      setMessage('Connection error');
    }
  };

  // Add todo
  const addTodo = async (e) => {
    e.preventDefault();
    if (!newTodo.trim()) return;

    console.log('🚀 Adding todo...');
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      console.log('📤 Request headers:', headers);
      
      const response = await fetch(`${API_URL}/api/todos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify({
          title: newTodo,
          description: '',
          priority
        })
      });

      console.log('📥 Response status:', response.status);
      
      if (response.ok) {
        setNewTodo('');
        setMessage('Todo added!');
        fetchTodos();
      } else {
        const errorData = await response.text();
        console.error('❌ Response error:', errorData);
        setMessage(`Failed to add todo: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Network error:', error);
      setMessage('Connection error');
    }
    setLoading(false);
  };

  // Toggle todo completion
  const toggleTodo = async (todo) => {
    try {
      const response = await fetch(`${API_URL}/api/todos/${todo.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          ...todo,
          completed: !todo.completed
        })
      });

      if (response.ok) {
        fetchTodos();
      }
    } catch (error) {
      setMessage('Connection error');
    }
  };

  // Delete todo
  const deleteTodo = async (id) => {
    if (!window.confirm('Delete this todo?')) return;

    try {
      const response = await fetch(`${API_URL}/api/todos/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        setMessage('Todo deleted!');
        fetchTodos();
      }
    } catch (error) {
      setMessage('Connection error');
    }
  };

  // Load admin data
  const loadAdminData = async () => {
    if (!user?.isAdmin && !user?.roles?.includes('admin')) return;

    try {
      const [usersResponse, statsResponse] = await Promise.all([
        fetch(`${API_URL}/api/admin/users`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/api/admin/stats`, { headers: getAuthHeaders() })
      ]);

      if (usersResponse.ok && statsResponse.ok) {
        const users = await usersResponse.json();
        const stats = await statsResponse.json();
        setAdminData({ users: Array.isArray(users) ? users : [], stats });
      }
    } catch (error) {
      setMessage('Failed to load admin data');
    }
  };

  // Change user role (admin only)
  const changeUserRole = async (userId, newRole) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ role: newRole })
      });

      if (response.ok) {
        setMessage(`User role updated to ${newRole}`);
        loadAdminData();
      } else {
        setMessage('Failed to update user role');
      }
    } catch (error) {
      setMessage('Connection error');
    }
  };

  // Show admin panel
  const toggleAdminPanel = () => {
    setShowAdmin(!showAdmin);
    if (!showAdmin && (user?.isAdmin || user?.roles?.includes('admin'))) {
      loadAdminData();
    }
  };

  // Show message temporarily
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Loading state
  if (!keycloakInitialized) {
    return (
      <div className="app">
        <div className="container">
          <h1>📝 Todo App</h1>
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  // Login screen
  if (!user) {
    return (
      <div className="app">
        <div className="container">
          <h1>📝 Todo App</h1>
          <h2>Microservices Project with Keycloak</h2>
          
          {/* Keycloak Login Button */}
          <div className="login-form">
            <h3>Login with Keycloak (Recommended)</h3>
            <button 
              onClick={loginWithKeycloak}
              className="keycloak-btn"
              style={{
                width: '100%',
                padding: '12px',
                background: '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '16px',
                cursor: 'pointer',
                marginBottom: '20px'
              }}
            >
              🔐 Login with Keycloak
            </button>
            
            <div style={{ textAlign: 'center', margin: '20px 0', color: '#666' }}>
              OR
            </div>

            {/* Legacy Login Form */}
            <h3>Legacy Login</h3>
            <form onSubmit={registerMode ? legacyRegister : legacyLogin}>
              {registerMode && (
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              )}
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="submit" disabled={loading}>
                {loading ? (registerMode ? 'Registering...' : 'Logging in...') : (registerMode ? 'Register' : 'Login')}
              </button>
              <p style={{ marginTop: '10px' }}>
                {registerMode ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button 
                  type="button" 
                  onClick={() => setRegisterMode(!registerMode)} 
                  style={{ color: 'blue', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  {registerMode ? 'Login' : 'Register'}
                </button>
              </p>
            </form>
          </div>

          {message && <div className="message">{message}</div>}
          
          <div className="demo-info">
            <p><strong>Keycloak Users:</strong></p>
            <p>Admin: admin / admin123</p>
            <p>User: demo / demo123</p>
            <br />
            <p><strong>Legacy Users:</strong></p>
            <p>demo@example.com / demo123</p>
          </div>
        </div>
      </div>
    );
  }

  // Main app
  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1>📝 Todo App</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>Welcome, {user.username || user.firstName || 'User'}!</span>
            <span style={{ fontSize: '12px', color: '#666' }}>
              ({authMethod}) {user.isAdmin || user.roles?.includes('admin') ? '👑 Admin' : '👤 User'}
            </span>
            {(user.isAdmin || user.roles?.includes('admin')) && (
              <button 
                onClick={toggleAdminPanel}
                style={{
                  background: showAdmin ? '#e74c3c' : '#f39c12',
                  color: 'white',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                {showAdmin ? 'Hide Admin' : 'Admin Panel'}
              </button>
            )}
            <button onClick={logout} className="logout-btn">Logout</button>
          </div>
        </header>

        {message && <div className="message">{message}</div>}

        {/* Admin Panel */}
        {showAdmin && (user.isAdmin || user.roles?.includes('admin')) && (
          <div className="admin-panel" style={{
            background: '#f8f9fa',
            border: '2px solid #e9ecef',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '30px'
          }}>
            <h3>👑 Admin Panel</h3>
            
            {/* System Stats */}
            <div className="admin-stats" style={{ marginBottom: '20px' }}>
              <h4>System Statistics</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                <div style={{ background: 'white', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3498db' }}>
                    {adminData.stats.total_users || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Total Users</div>
                </div>
                <div style={{ background: 'white', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#27ae60' }}>
                    {adminData.stats.total_todos || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Total Todos</div>
                </div>
                <div style={{ background: 'white', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e74c3c' }}>
                    {adminData.stats.pending_todos || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Pending</div>
                </div>
                <div style={{ background: 'white', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f39c12' }}>
                    {adminData.stats.completed_todos || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Completed</div>
                </div>
              </div>
            </div>

            {/* Users Management */}
            <div className="users-management">
              <h4>Users Management</h4>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {adminData.users.map(u => (
                  <div key={u.id || u.user_id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px',
                    margin: '4px 0',
                    background: 'white',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}>
                    <div>
                      <strong>{u.username}</strong> ({u.email}) 
                      <span style={{ color: '#666', marginLeft: '8px' }}>
                        {u.total_todos || 0} todos
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        background: (u.role || 'user') === 'admin' ? '#e74c3c' : '#3498db',
                        color: 'white'
                      }}>
                        {u.role || 'user'}
                      </span>
                      <select
                        value={u.role || 'user'}
                        onChange={(e) => changeUserRole(u.id || u.user_id, e.target.value)}
                        style={{ fontSize: '12px', padding: '2px' }}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Regular Todo App */}
        <div className="stats">
          <div className="stat">
            <div className="stat-number">{todos.length}</div>
            <div className="stat-label">Total</div>
          </div>
          <div className="stat">
            <div className="stat-number">{todos.filter(t => t.completed).length}</div>
            <div className="stat-label">Completed</div>
          </div>
          <div className="stat">
            <div className="stat-number">{todos.filter(t => !t.completed).length}</div>
            <div className="stat-label">Pending</div>
          </div>
        </div>

        <form onSubmit={addTodo} className="add-form">
          <input
            type="text"
            placeholder="Add new todo..."
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            required
          />
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <button type="submit" disabled={loading}>
            {loading ? 'Adding...' : 'Add'}
          </button>
        </form>

        <div className="todos">
          {todos.length === 0 ? (
            <p>No todos yet. Add your first todo above!</p>
          ) : (
            todos.map(todo => (
              <div key={todo.id} className={`todo-item ${todo.completed ? 'completed' : ''}`}>
                <div className="todo-content">
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => toggleTodo(todo)}
                  />
                  <span className="todo-title">
                    {todo.title}
                    {todo.owner_username && (
                      <span style={{ fontSize: '12px', color: '#666', marginLeft: '8px' }}>
                        (by {todo.owner_username})
                      </span>
                    )}
                  </span>
                  <span className={`priority priority-${todo.priority}`}>
                    {todo.priority}
                  </span>
                </div>
                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="delete-btn"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default App;