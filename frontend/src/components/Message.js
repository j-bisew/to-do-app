const Message = ({ message, isError = false }) => {
  if (!message) return null;

  const style = isError ? {
    background: '#ffebee',
    color: '#c62828',
    border: '1px solid #ffcdd2'
  } : {
    background: '#d4edda',
    color: '#155724',
    border: '1px solid #c3e6cb'
  };

  return (
    <div 
      className={isError ? "error-message" : "message"}
      style={{
        ...style,
        padding: '12px',
        borderRadius: '6px',
        margin: '20px 0',
        textAlign: 'center'
      }}
    >
      {message}
    </div>
  );
};

export default Message;