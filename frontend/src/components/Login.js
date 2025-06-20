import React from 'react';
import { login, register } from '../services/keycloak';

const Login = ({ authError, message }) => {
  return (
    <div className="app">
      <div className="container">
        <h1>📝 Todo App</h1>
        <h2>Microservices Project with Keycloak</h2>
        
        {authError && (
          <div className="error-message" style={{
            background: '#ffebee',
            color: '#c62828',
            padding: '12px',
            borderRadius: '6px',
            margin: '20px 0',
            textAlign: 'center',
            border: '1px solid #ffcdd2'
          }}>
            {authError}
          </div>
        )}

        <div className="auth-section">
          <h3>🔐 Secure Authentication with Keycloak</h3>
          <p style={{ textAlign: 'center', color: '#666', marginBottom: '30px' }}>
            Experience modern Single Sign-On with PKCE security
          </p>
          
          <div className="auth-buttons" style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
            <button 
              onClick={login}
              style={{
                flex: 1,
                padding: '15px',
                background: '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              🔑 Login
            </button>
            
            <button 
              onClick={register}
              style={{
                flex: 1,
                padding: '15px',
                background: '#388e3c',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              ✨ Register
            </button>
          </div>
        </div>

        {message && <div className="message">{message}</div>}
        
        <div className="demo-info">
          <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
            <p><strong>🧪 Test Accounts:</strong></p>
            <p>Create your own account or use admin/admin123</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;