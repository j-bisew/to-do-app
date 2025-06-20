import React, { useState } from 'react';

const ViewToggle = ({ isAdmin, showAllTodos, onToggleView, allTodosCount, myTodosCount, onPreloadAllTodos }) => {
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [hasPreloaded, setHasPreloaded] = useState(false);

  if (!isAdmin) return null;

  const handleToggle = async (showAll) => {
    console.log('👑 Admin toggling view to:', showAll ? 'all users' : 'my todos');
    
    if (showAll && !hasPreloaded) {
      setIsLoadingAll(true);
      await onPreloadAllTodos();
      setHasPreloaded(true);
      setIsLoadingAll(false);
    }
    
    onToggleView(showAll);
  };

  // Show loading state for All Users button
  const allUsersLabel = isLoadingAll 
    ? "👥 Loading..." 
    : hasPreloaded || showAllTodos 
      ? `👥 All Users (${allTodosCount})` 
      : "👥 All Users";

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '15px',
      margin: '20px 0',
      padding: '15px',
      background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
      borderRadius: '12px',
      border: '2px solid #dee2e6'
    }}>
      <span style={{ 
        fontSize: '14px', 
        color: '#495057',
        fontWeight: '600'
      }}>
        👑 Admin View:
      </span>
      
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={() => handleToggle(false)}
          style={{
            padding: '8px 16px',
            borderRadius: '20px',
            border: '2px solid',
            borderColor: !showAllTodos ? '#3498db' : '#dee2e6',
            background: !showAllTodos ? '#3498db' : 'white',
            color: !showAllTodos ? 'white' : '#6c757d',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
        >
          📝 My Todos ({myTodosCount})
        </button>
        
        <button
          onClick={() => handleToggle(true)}
          disabled={isLoadingAll}
          style={{
            padding: '8px 16px',
            borderRadius: '20px',
            border: '2px solid',
            borderColor: showAllTodos ? '#e74c3c' : '#dee2e6',
            background: showAllTodos ? '#e74c3c' : 'white',
            color: showAllTodos ? 'white' : '#6c757d',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: isLoadingAll ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            opacity: isLoadingAll ? 0.7 : 1
          }}
        >
          {allUsersLabel}
        </button>
      </div>
      
      <div style={{ 
        fontSize: '12px', 
        color: '#6c757d',
        fontStyle: 'italic'
      }}>
        {showAllTodos ? 'Viewing todos from all users' : 'Viewing only your todos'}
      </div>
    </div>
  );
};

export default ViewToggle;