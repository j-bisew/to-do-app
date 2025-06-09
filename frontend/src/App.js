import React, { useState, useEffect } from 'react';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function App() {
  const [user, setUser] = useState(null);
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState('');
  const [email, setEmail] = useState('test1@example.com');
  const [password, setPassword] = useState('demo123');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [registerMode, setRegisterMode] = useState(false);
  const [username, setUsername] = useState('');
  const [priority, setPriority] = useState('medium');


  // Load user on startup
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
      fetchTodos();
    }
  }, []);

  const register = async (e) => {
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
      setUser(data.user);
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


  // Login function
  const login = async (e) => {
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
        setUser(data.user);
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

  // Logout function
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setTodos([]);
    setMessage('Logged out');
  };

  // Fetch todos
  const fetchTodos = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/todos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setTodos(data);
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

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/todos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
      } else {
        setMessage('Failed to add todo');
      }
    } catch (error) {
      setMessage('Connection error');
    }
    setLoading(false);
  };

  // Toggle todo completion
  const toggleTodo = async (todo) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/todos/${todo.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/todos/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setMessage('Todo deleted!');
        fetchTodos();
      }
    } catch (error) {
      setMessage('Connection error');
    }
  };

  // Show message temporarily
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Login screen
  if (!user) {
    return (
      <div className="app">
        <div className="container">
          <h1>📝 Todo App</h1>
          <h2>Microservices Project</h2>
          
          <form onSubmit={registerMode ? register : login} className="login-form">
            <h3>{registerMode ? 'Register' : 'Login'}</h3>

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
              <button type="button" onClick={() => setRegisterMode(!registerMode)} style={{ color: 'blue', background: 'none', border: 'none' }}>
                {registerMode ? 'Login' : 'Register'}
              </button>
            </p>
          </form>


          {message && <div className="message">{message}</div>}
          
          <div className="demo-info">
            <p>Demo account: test1@example.com / demo123</p>
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
          <div>
            <span>Welcome, {user.username}!</span>
            <button onClick={logout} className="logout-btn">Logout</button>
          </div>
        </header>

        {message && <div className="message">{message}</div>}

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
                  <span className="todo-title">{todo.title}</span>
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