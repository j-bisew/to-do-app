import React, { useEffect, useRef } from 'react';
import './App.css';

// Components
import Loading from './components/Loading';
import Login from './components/Login';
import Header from './components/Header';
import Message from './components/Message';
import Stats from './components/Stats';
import TodoForm from './components/TodoForm';
import TodoList from './components/TodoList';
import AdminPanel from './components/AdminPanel';
import ViewToggle from './components/ViewToggle';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useMessage } from './hooks/useMessage';
import { useTodos } from './hooks/useTodos';
import { useAdmin } from './hooks/useAdmin';

function App() {
  console.log('🚀 App component rendering...');

  const { user, keycloakInitialized, authError, isAuthenticated, clearAuthError } = useAuth();
  const [message, setMessage] = useMessage();
  const { todos, allTodos, myTodos, showAllTodos, loading, fetchTodos, addTodo, toggleTodo, deleteTodo, toggleView, preloadAllTodos } = useTodos(
    (error) => clearAuthError() || setMessage(error), 
    setMessage
  );
  const { adminData, showAdmin, changeUserRole, toggleAdminPanel } = useAdmin(
    (error) => clearAuthError() || setMessage(error),
    setMessage
  );

  const initialFetchDone = useRef(false);

  console.log('📊 App state:', {
    keycloakInitialized,
    user: user?.username,
    isAuthenticated,
    authError,
    message,
    todosCount: todos?.length
  });

  // Fetch todos when user is authenticated (only once)
  useEffect(() => {
    if (user && isAuthenticated && !initialFetchDone.current) {
      console.log('🚀 Initial todos fetch for user:', user.username);
      initialFetchDone.current = true;
      fetchTodos(true); // Force initial fetch
    }
  }, [user, isAuthenticated, fetchTodos]);

  // Reset fetch flag when user changes
  useEffect(() => {
    if (!user || !isAuthenticated) {
      initialFetchDone.current = false;
    }
  }, [user, isAuthenticated]);

  // Loading state
  if (!keycloakInitialized) {
    console.log('⏳ Showing loading screen - Keycloak not initialized');
    return <Loading message="Initializing authentication..." />;
  }

  // Login screen
  if (!user || !isAuthenticated) {
    console.log('🔐 Showing login screen - User not authenticated');
    return <Login authError={authError} message={message} />;
  }

  console.log('✅ Rendering main app for user:', user.username);

  // Main app
  return (
    <div className="app">
      <div className="container">
        <Header 
          user={user} 
          showAdmin={showAdmin} 
          onToggleAdmin={() => toggleAdminPanel(user.isAdmin)} 
        />

        <Message message={authError} isError={true} />
        <Message message={message} isError={false} />

        {/* Admin Panel */}
        {showAdmin && user.isAdmin && (
          <AdminPanel
            adminData={adminData}
            onChangeUserRole={changeUserRole}
          />
        )}

        {/* Admin View Toggle */}
        <ViewToggle
          isAdmin={user.isAdmin}
          showAllTodos={showAllTodos}
          onToggleView={toggleView}
          onPreloadAllTodos={preloadAllTodos}
          allTodosCount={allTodos?.length || 0}
          myTodosCount={myTodos?.length || 0}
        />

        {/* Todo App - Stats use current view */}
        <Stats todos={todos} />
        
        <TodoForm 
          onAddTodo={addTodo} 
          loading={loading} 
        />

        <TodoList
          todos={todos}
          user={user}
          onToggleTodo={toggleTodo}
          onDeleteTodo={deleteTodo}
        />

        {/* Enhanced Debug info */}
        <div style={{ 
          position: 'fixed', 
          bottom: '10px', 
          right: '10px', 
          background: 'rgba(0,0,0,0.9)', 
          color: 'white', 
          padding: '15px', 
          borderRadius: '8px', 
          fontSize: '12px',
          maxWidth: '350px',
          fontFamily: 'monospace',
          zIndex: 1000
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>🐛 Debug Info</div>
          <div>User: {user?.username || 'null'}</div>
          <div>Auth: {isAuthenticated ? 'Yes' : 'No'}</div>
          <div>Keycloak Init: {keycloakInitialized ? 'Yes' : 'No'}</div>
          <div>Todos: {todos?.length || 0} ({showAllTodos ? 'All Users' : 'My Todos'})</div>
          <div>My Todos: {myTodos?.length || 0}</div>
          <div>All Todos: {allTodos?.length || 0}</div>
          <div>Loading: {loading ? 'Yes' : 'No'}</div>
          <div>Auth Error: {authError || 'None'}</div>
          <div>Message: {message || 'None'}</div>
          <div>Show Admin: {showAdmin ? 'Yes' : 'No'}</div>
          <div>Is Admin: {user?.isAdmin ? 'Yes' : 'No'}</div>
        </div>
      </div>
    </div>
  );
}

export default App;