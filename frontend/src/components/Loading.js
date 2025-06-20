import React from 'react';

const Loading = ({ message = "Loading..." }) => {
  return (
    <div className="app">
      <div className="container">
        <h1>📝 Todo App</h1>
        <h2>{message}</h2>
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <div className="spinner"></div>
        </div>
      </div>
    </div>
  );
};

export default Loading;