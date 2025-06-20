import React, { useState } from 'react';

const TodoForm = ({ onAddTodo, loading }) => {
  const [newTodo, setNewTodo] = useState('');
  const [priority, setPriority] = useState('medium');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newTodo.trim()) return;

    onAddTodo({
      title: newTodo,
      description: '',
      priority
    });

    setNewTodo('');
  };

  return (
    <form onSubmit={handleSubmit} className="add-form">
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
  );
};

export default TodoForm;