import React from 'react';

const Stats = ({ todos }) => {
  const totalTodos = todos.length;
  const completedTodos = todos.filter(t => t.completed).length;
  const pendingTodos = todos.filter(t => !t.completed).length;

  return (
    <div className="stats">
      <div className="stat">
        <div className="stat-number">{totalTodos}</div>
        <div className="stat-label">Total</div>
      </div>
      <div className="stat">
        <div className="stat-number">{completedTodos}</div>
        <div className="stat-label">Completed</div>
      </div>
      <div className="stat">
        <div className="stat-number">{pendingTodos}</div>
        <div className="stat-label">Pending</div>
      </div>
    </div>
  );
};

export default Stats;