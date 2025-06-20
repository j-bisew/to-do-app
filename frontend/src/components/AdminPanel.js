const AdminPanel = ({ adminData, onChangeUserRole }) => {
  return (
    <div className="admin-panel" style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      border: '2px solid #5a67d8',
      borderRadius: '12px',
      padding: '25px',
      marginBottom: '30px',
      boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
    }}>
      <h3 style={{ color: 'white', marginBottom: '20px' }}>👑 Admin Control Panel</h3>
      
      {/* System Stats */}
      <div className="admin-stats" style={{ marginBottom: '25px' }}>
        <h4 style={{ color: 'white' }}>📊 System Statistics</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#fff' }}>
              {adminData.stats.total_users || 0}
            </div>
            <div style={{ fontSize: '12px', color: '#e2e8f0' }}>Total Users</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.2)', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#fff' }}>
              {adminData.stats.total_todos || 0}
            </div>
            <div style={{ fontSize: '12px', color: '#e2e8f0' }}>Total Todos</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.2)', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#fff' }}>
              {adminData.stats.pending_todos || 0}
            </div>
            <div style={{ fontSize: '12px', color: '#e2e8f0' }}>Pending</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.2)', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#fff' }}>
              {adminData.stats.completed_todos || 0}
            </div>
            <div style={{ fontSize: '12px', color: '#e2e8f0' }}>Completed</div>
          </div>
        </div>
      </div>

      {/* Users Management */}
      <div className="users-management">
        <h4 style={{ color: 'white' }}>👥 User Management</h4>
        <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
          {adminData.users.map(u => (
            <div key={u.id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              margin: '8px 0',
              background: 'rgba(255,255,255,0.15)',
              borderRadius: '8px',
              fontSize: '14px'
            }}>
              <div>
                <strong style={{ color: 'white' }}>{u.username}</strong> 
                <span style={{ color: '#e2e8f0' }}> ({u.email})</span>
                <div style={{ fontSize: '12px', color: '#cbd5e0' }}>
                  {u.total_todos || 0} todos • Joined {new Date(u.created_at).toLocaleDateString()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  background: u.role === 'admin' ? '#e74c3c' : '#3498db',
                  color: 'white'
                }}>
                  {u.role === 'admin' ? '👑 Admin' : '👤 User'}
                </span>
                <select
                  value={u.role || 'user'}
                  onChange={(e) => onChangeUserRole(u.id, e.target.value)}
                  style={{ 
                    fontSize: '12px', 
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: 'none',
                    background: 'white'
                  }}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;