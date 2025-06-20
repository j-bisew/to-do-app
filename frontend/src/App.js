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
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminData, setAdminData] = useState({ users: [], stats: {} });
  const [authError, setAuthError] = useState('');

  // Initialize Keycloak on startup
  useEffect(() => {
    const initKeycloak = async () => {
      try {
        console.log('🔧 Initializing Keycloak...');
        const authenticated = await keycloak.init({
          onLoad: 'check-sso',
          silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
          pkceMethod: 'S256' // Enable PKCE
        });

        setKeycloakInitialized(true);

        if (authenticated) {
          console.log('✅ User authenticated with Keycloak');
          await loadKeycloakUser();
          await fetchTodos();
        } else {
          console.log('🔓 User not authenticated');
          setAuthError('');
        }

        // Setup token refresh
        setInterval(() => {
          keycloak.updateToken(70).then((refreshed) => {
            if (refreshed) {
              console.log('🔄 Token refreshed');
            }
          }).catch(() => {
            console.log('❌ Failed to refresh token');
            setAuthError('Session expired. Please login again.');
          });
        }, 60000);

      } catch (error) {
        console.error('❌ Keycloak initialization failed:', error);
        setKeycloakInitialized(true);
        setAuthError('Failed to initialize authentication. Please refresh the page.');
      }
    };

    initKeycloak();
  }, []);

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

      console.log('👤 User loaded:', userProfile.username, 'Roles:', roles);
    } catch (error) {
      console.error('Failed to load user profile:', error);
      setAuthError('Failed to load user profile');
    }
  };

  // Login with Keycloak
  const loginWithKeycloak = () => {
    setAuthError('');
    keycloak.login({
      redirectUri: window.location.origin
    });
  };

  // Register with Keycloak
  const registerWithKeycloak = () => {
    setAuthError('');
    keycloak.register({
      redirectUri: window.location.origin
    });
  };

  // Logout
  const logout = () => {
    keycloak.logout({
      redirectUri: window.location.origin
    });
  };

  // Get auth headers with token refresh
  const getAuthHeaders = async () => {
    if (!keycloak.authenticated) {
      throw new Error('Not authenticated');
    }

    try {
      // Refresh token if it expires soon (within 30 seconds)
      await keycloak.updateToken(30);
      return { 'Authorization': `Bearer ${keycloak.token}` };
    } catch (error) {
      console.error('❌ Failed to refresh token:', error);
      setAuthError('Session expired. Please login again.');
      throw error;
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
        setTodos(Array.isArray(data) ? data : []);
      } else if (response.status === 401 || response.status === 403) {
        setAuthError('Authentication failed. Please login again.');
      } else {
        setMessage('Failed to load todos');
      }
    } catch (error) {
      console.error('Error fetching todos:', error);
      setMessage('Connection error');
    }
  };

  // Add todo
  const addTodo = async (e) => {
    e.preventDefault();
    if (!newTodo.trim()) return;

    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      
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

      if (response.ok) {
        setNewTodo('');
        setMessage('Todo added!');
        fetchTodos();
      } else if (response.status === 401 || response.status === 403) {
        setAuthError('Authentication failed. Please login again.');
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
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/api/todos/${todo.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify({
          ...todo,
          completed: !todo.completed
        })
      });

      if (response.ok) {
        fetchTodos();
      } else if (response.status === 401 || response.status === 403) {
        setAuthError('Authentication failed. Please login again.');
      }
    } catch (error) {
      setMessage('Connection error');
    }
  };

  // Delete todo
  const deleteTodo = async (id) => {
    if (!window.confirm('Delete this todo?')) return;

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/api/todos/${id}`, {
        method: 'DELETE',
        headers
      });

      if (response.ok) {
        setMessage('Todo deleted!');
        fetchTodos();
      } else if (response.status === 401 || response.status === 403) {
        setAuthError('Authentication failed. Please login again.');
      }
    } catch (error) {
      setMessage('Connection error');
    }
  };

  // Load admin data
  const loadAdminData = async () => {
    if (!user?.isAdmin) return;

    try {
      const headers = await getAuthHeaders();
      const [usersResponse, statsResponse] = await Promise.all([
        fetch(`${API_URL}/api/admin/users`, { headers }),
        fetch(`${API_URL}/api/admin/stats`, { headers })
      ]);

      if (usersResponse.ok && statsResponse.ok) {
        const users = await usersResponse.json();
        const stats = await statsResponse.json();
        setAdminData({ users: Array.isArray(users) ? users : [], stats });
      } else if (usersResponse.status === 401 || usersResponse.status === 403) {
        setAuthError('Admin access denied. Please login again.');
      }
    } catch (error) {
      setMessage('Failed to load admin data');
    }
  };

  // Change user role (admin only)
  const changeUserRole = async (userId, newRole) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify({ role: newRole })
      });

      if (response.ok) {
        setMessage(`User role updated to ${newRole}`);
        loadAdminData();
      } else if (response.status === 401 || response.status === 403) {
        setAuthError('Admin access denied. Please login again.');
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
    if (!showAdmin && user?.isAdmin) {
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

  // Show auth error temporarily
  useEffect(() => {
    if (authError) {
      const timer = setTimeout(() => setAuthError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [authError]);

  // Loading state
  if (!keycloakInitialized) {
    return (
      <div className="app">
        <div className="container">
          <h1>📝 Todo App</h1>
          <h2>Initializing authentication...</h2>
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <div className="spinner"></div>
          </div>
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
          
          {authError && (
            <div className="error-message" style={{
              background: '#ffebee',
              color: '#c62828',
              padding: '12px',
              borderRadius: '6px',
              margin: '20px 0',
              textAlign: 'center',
              border: '1px solid #ffcdd2'
            }}>
              {authError}
            </div>
          )}

          <div className="auth-section">
            <h3>🔐 Secure Authentication with Keycloak</h3>
            <p style={{ textAlign: 'center', color: '#666', marginBottom: '30px' }}>
              Experience modern Single Sign-On with PKCE security
            </p>
            
            <div className="auth-buttons" style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
              <button 
                onClick={loginWithKeycloak}
                style={{
                  flex: 1,
                  padding: '15px',
                  background: '#1976d2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                🔑 Login
              </button>
              
              <button 
                onClick={registerWithKeycloak}
                style={{
                  flex: 1,
                  padding: '15px',
                  background: '#388e3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                ✨ Register
              </button>
            </div>
          </div>

          {message && <div className="message">{message}</div>}
          
          <div className="demo-info">
            <h4>🎯 Project Features</h4>
            <ul style={{ textAlign: 'left', margin: '15px 0' }}>
              <li>✅ <strong>Keycloak SSO</strong> - Secure authentication</li>
              <li>✅ <strong>PKCE Security</strong> - Modern OAuth2 flow</li>
              <li>✅ <strong>Role-based Access</strong> - User/Admin roles</li>
              <li>✅ <strong>Admin Panel</strong> - User management</li>
              <li>✅ <strong>Microservices</strong> - Scalable architecture</li>
              <li>✅ <strong>Real-time</strong> - Live notifications</li>
            </ul>
            
            <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
              <p><strong>🧪 Test Accounts:</strong></p>
              <p>Create your own account or use admin/admin123</p>
            </div>
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
            <div className="user-info">
              <span>Welcome, <strong>{user.firstName || user.username}!</strong></span>
              <div style={{ fontSize: '12px', color: '#666' }}>
                🔐 Keycloak {user.isAdmin ? '👑 Admin' : '👤 User'}
              </div>
            </div>
            {user.isAdmin && (
              <button 
                onClick={toggleAdminPanel}
                style={{
                  background: showAdmin ? '#e74c3c' : '#f39c12',
                  color: 'white',
                  border: 'none',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                {showAdmin ? 'Hide Admin' : '⚡ Admin Panel'}
              </button>
            )}
            <button onClick={logout} className="logout-btn">Logout</button>
          </div>
        </header>

        {authError && (
          <div className="error-message" style={{
            background: '#ffebee',
            color: '#c62828',
            padding: '12px',
            borderRadius: '6px',
            margin: '20px 0',
            textAlign: 'center',
            border: '1px solid #ffcdd2'
          }}>
            {authError}
          </div>
        )}

        {message && <div className="message">{message}</div>}

        {/* Admin Panel */}
        {showAdmin && user.isAdmin && (
          <div className="admin-panel" style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: '2px solid #5a67d8',
            borderRadius: '12px',
            padding: '25px',
            marginBottom: '30px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ color: 'white', marginBottom: '20px' }}>👑 Admin Control Panel</h3>
            
            {/* System Stats */}
            <div className="admin-stats" style={{ marginBottom: '25px' }}>
              <h4 style={{ color: 'white' }}>📊 System Statistics</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' }}>
                <div style={{ background: 'rgba(255,255,255,0.2)', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#fff' }}>
                    {adminData.stats.total_users || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#e2e8f0' }}>Total Users</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.2)', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#fff' }}>
                    {adminData.stats.total_todos || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#e2e8f0' }}>Total Todos</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.2)', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#fff' }}>
                    {adminData.stats.pending_todos || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#e2e8f0' }}>Pending</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.2)', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#fff' }}>
                    {adminData.stats.completed_todos || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#e2e8f0' }}>Completed</div>
                </div>
              </div>
            </div>

            {/* Users Management */}
            <div className="users-management">
              <h4 style={{ color: 'white' }}>👥 User Management</h4>
              <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                {adminData.users.map(u => (
                  <div key={u.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    margin: '8px 0',
                    background: 'rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}>
                    <div>
                      <strong style={{ color: 'white' }}>{u.username}</strong> 
                      <span style={{ color: '#e2e8f0' }}> ({u.email})</span>
                      <div style={{ fontSize: '12px', color: '#cbd5e0' }}>
                        {u.total_todos || 0} todos • Joined {new Date(u.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        background: u.role === 'admin' ? '#e74c3c' : '#3498db',
                        color: 'white'
                      }}>
                        {u.role === 'admin' ? '👑 Admin' : '👤 User'}
                      </span>
                      <select
                        value={u.role || 'user'}
                        onChange={(e) => changeUserRole(u.id, e.target.value)}
                        style={{ 
                          fontSize: '12px', 
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: 'none',
                          background: 'white'
                        }}
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
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              <h3>🎯 No todos yet!</h3>
              <p>Add your first todo above to get started.</p>
            </div>
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
                    {todo.owner_username && todo.owner_username !== user.username && (
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