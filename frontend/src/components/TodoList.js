import TodoItem from './TodoItem';

const TodoList = ({ todos, user, onToggleTodo, onDeleteTodo }) => {
  if (todos.length === 0) {
    return (
      <div className="todos">
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          <h3>🎯 No todos yet!</h3>
          <p>Add your first todo above to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="todos">
      {todos.map(todo => (
        <TodoItem
          key={todo.id}
          todo={todo}
          user={user}
          onToggle={() => onToggleTodo(todo)}
          onDelete={() => onDeleteTodo(todo.id)}
        />
      ))}
    </div>
  );
};

export default TodoList;