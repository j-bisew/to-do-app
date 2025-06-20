import React from 'react';
import { logout } from '../services/keycloak';

const Header = ({ user, showAdmin, onToggleAdmin }) => {
  return (
    <header className="header">
      <h1>📝 Todo App</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div className="user-info">
          <span>Welcome, <strong>{user.firstName || user.username}!</strong></span>
          <div style={{ fontSize: '12px', color: '#666' }}>
            🔐 Keycloak {user.isAdmin ? '👑 Admin' : '👤 User'}
          </div>
        </div>
        {user.isAdmin && (
          <button 
            onClick={onToggleAdmin}
            style={{
              background: showAdmin ? '#e74c3c' : '#f39c12',
              color: 'white',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            {showAdmin ? 'Hide Admin' : '⚡ Admin Panel'}
          </button>
        )}
        <button onClick={logout} className="logout-btn">Logout</button>
      </div>
    </header>
  );
};

export default Header;