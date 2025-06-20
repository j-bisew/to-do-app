import { useState, useCallback, useRef } from 'react';
import { todoAPI } from '../services/api';

export const useTodos = (onAuthError, onMessage) => {
  const [todos, setTodos] = useState([]);
  const [allTodos, setAllTodos] = useState([]);
  const [myTodos, setMyTodos] = useState([]);
  const [showAllTodos, setShowAllTodos] = useState(false);
  const [loading, setLoading] = useState(false);
  const fetchingRef = useRef(false);
  const lastFetchRef = useRef(0);

  // Update current view when data changes - DEFINE FIRST
  const updateCurrentView = useCallback(() => {
    setTodos(showAllTodos ? allTodos : myTodos);
  }, [showAllTodos, allTodos, myTodos]);

  // Preload all todos for admin (used by ViewToggle)
  const preloadAllTodos = useCallback(async () => {
    if (allTodos.length > 0) {
      console.log('📋 All todos already loaded, skipping preload');
      return;
    }

    try {
      console.log('📡 Preloading all todos for admin...');
      const allTodosData = await todoAPI.getAllUsers();
      const allTodosArray = Array.isArray(allTodosData) ? allTodosData : [];
      setAllTodos(allTodosArray);
      console.log('✅ All todos preloaded:', allTodosArray.length);
    } catch (error) {
      console.error('❌ Failed to preload all todos:', error);
      onMessage('Failed to load all todos');
    }
  }, [allTodos.length, onMessage]);

  // Toggle view between my todos and all todos (admin only)
  const toggleView = useCallback((showAll) => {
    console.log('🔄 Switching to', showAll ? 'all todos' : 'my todos');
    setShowAllTodos(showAll);
    setTodos(showAll ? allTodos : myTodos);
  }, [allTodos, myTodos]);

  // Fetch todos with rate limiting protection
  const fetchTodos = useCallback(async (force = false) => {
    // Prevent multiple simultaneous fetches
    if (fetchingRef.current && !force) {
      console.log('⏳ Fetch already in progress, skipping...');
      return;
    }

    // Rate limiting: minimum 2 seconds between fetches
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchRef.current;
    if (timeSinceLastFetch < 2000 && !force) {
      console.log('⏳ Rate limiting: too soon since last fetch');
      return;
    }

    fetchingRef.current = true;
    lastFetchRef.current = now;

    try {
      console.log('📡 Fetching todos...');
      
      // Always fetch user's personal todos first
      const myTodosData = await todoAPI.getMy();
      const myTodosArray = Array.isArray(myTodosData) ? myTodosData : [];
      setMyTodos(myTodosArray);
      
      // Fetch all todos only if currently showing all view
      let allTodosArray = [];
      if (showAllTodos) {
        try {
          const allTodosData = await todoAPI.getAllUsers();
          allTodosArray = Array.isArray(allTodosData) ? allTodosData : [];
        } catch (error) {
          console.warn('⚠️ Failed to fetch all todos:', error);
          allTodosArray = [];
        }
      }
      setAllTodos(allTodosArray);
      
      // Set current view based on showAllTodos flag
      setTodos(showAllTodos ? allTodosArray : myTodosArray);
      
      console.log('✅ Todos fetched successfully:', allTodosArray.length, 'total,', myTodosArray.length, 'mine');
    } catch (error) {
      console.error('❌ Error fetching todos:', error);
      if (error.message === 'AUTH_ERROR') {
        onAuthError('Authentication failed. Please login again.');
      } else if (error.message === 'HTTP 429') {
        onMessage('Too many requests. Please wait a moment before trying again.');
      } else {
        onMessage('Failed to load todos');
      }
    } finally {
      fetchingRef.current = false;
    }
  }, [onAuthError, onMessage, showAllTodos]);

  // Add todo
  const addTodo = useCallback(async (todoData) => {
    if (loading) {
      console.log('⏳ Already adding todo, skipping...');
      return;
    }

    setLoading(true);
    try {
      console.log('➕ Adding todo:', todoData.title);
      await todoAPI.create(todoData);
      onMessage('Todo added!');
      // Fetch with a small delay to allow backend processing
      setTimeout(() => {
        fetchTodos(true).then(() => {
          // Update view after fetch
          updateCurrentView();
        });
      }, 500);
    } catch (error) {
      console.error('❌ Error creating todo:', error);
      if (error.message === 'AUTH_ERROR') {
        onAuthError('Authentication failed. Please login again.');
      } else if (error.message === 'HTTP 429') {
        onMessage('Too many requests. Please wait a moment before trying again.');
      } else {
        onMessage('Failed to add todo');
      }
    }
    setLoading(false);
  }, [fetchTodos, onAuthError, onMessage, loading, updateCurrentView]);

  // Toggle todo completion
  const toggleTodo = useCallback(async (todo) => {
    try {
      console.log('🔄 Toggling todo:', todo.id);
      await todoAPI.update(todo.id, {
        ...todo,
        completed: !todo.completed
      });
      
      // Update both arrays optimistically
      const updateTodoInArray = (todosArray) => 
        todosArray.map(t => 
          t.id === todo.id ? { ...t, completed: !t.completed } : t
        );
      
      setAllTodos(prev => updateTodoInArray(prev));
      setMyTodos(prev => updateTodoInArray(prev));
      updateCurrentView();
      
    } catch (error) {
      console.error('❌ Error updating todo:', error);
      // Revert optimistic update on error
      const revertTodoInArray = (todosArray) => 
        todosArray.map(t => 
          t.id === todo.id ? { ...t, completed: todo.completed } : t
        );
      
      setAllTodos(prev => revertTodoInArray(prev));
      setMyTodos(prev => revertTodoInArray(prev));
      updateCurrentView();
      
      if (error.message === 'AUTH_ERROR') {
        onAuthError('Authentication failed. Please login again.');
      } else if (error.message === 'HTTP 429') {
        onMessage('Too many requests. Please wait a moment before trying again.');
      } else {
        onMessage('Failed to update todo');
      }
    }
  }, [onAuthError, onMessage, updateCurrentView]);

  // Delete todo
  const deleteTodo = useCallback(async (id) => {
    try {
      console.log('🗑️ Deleting todo:', id);
      await todoAPI.delete(id);
      onMessage('Todo deleted!');
      
      // Optimistic update both arrays
      setAllTodos(prevTodos => prevTodos.filter(t => t.id !== id));
      setMyTodos(prevTodos => prevTodos.filter(t => t.id !== id));
      updateCurrentView();
      
    } catch (error) {
      console.error('❌ Error deleting todo:', error);
      // Refresh on error to restore state
      fetchTodos(true);
      
      if (error.message === 'AUTH_ERROR') {
        onAuthError('Authentication failed. Please login again.');
      } else if (error.message === 'HTTP 429') {
        onMessage('Too many requests. Please wait a moment before trying again.');
      } else {
        onMessage('Failed to delete todo');
      }
    }
  }, [fetchTodos, onAuthError, onMessage, updateCurrentView]);

  return {
    todos,
    allTodos,
    myTodos,
    showAllTodos,
    loading,
    fetchTodos,
    addTodo,
    toggleTodo,
    deleteTodo,
    toggleView,
    updateCurrentView,
    preloadAllTodos
  };
};