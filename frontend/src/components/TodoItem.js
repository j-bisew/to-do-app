const TodoItem = ({ todo, user, onToggle, onDelete }) => {
  const handleDelete = () => {
    if (window.confirm('Delete this todo?')) {
      onDelete();
    }
  };

  return (
    <div className={`todo-item ${todo.completed ? 'completed' : ''}`}>
      <div className="todo-content">
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={onToggle}
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
        onClick={handleDelete}
        className="delete-btn"
      >
        Delete
      </button>
    </div>
  );
};

export default TodoItem;