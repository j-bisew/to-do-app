import { getAuthHeaders } from './keycloak';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Generic API call helper
const apiCall = async (endpoint, options = {}) => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...options.headers
      }
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('AUTH_ERROR');
      }
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};

// Todo API calls
export const todoAPI = {
  // Get todos - optionally get all todos for admin
  getAll: (viewAll = false) => {
    const endpoint = viewAll ? '/api/todos?viewAll=true' : '/api/todos';
    return apiCall(endpoint);
  },

  // Get my todos specifically (always user's own todos)
  getMy: () => apiCall('/api/todos'),

  // Get all todos (admin only)
  getAllUsers: () => apiCall('/api/todos?viewAll=true'),

  // Create new todo
  create: (todoData) => apiCall('/api/todos', {
    method: 'POST',
    body: JSON.stringify(todoData)
  }),

  // Update todo
  update: (id, todoData) => apiCall(`/api/todos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(todoData)
  }),

  // Delete todo
  delete: (id) => apiCall(`/api/todos/${id}`, {
    method: 'DELETE'
  })
};

// Auth API calls
export const authAPI = {
  // Get user profile
  getProfile: () => apiCall('/api/auth/profile')
};

// Admin API calls
export const adminAPI = {
  // Get all users
  getUsers: () => apiCall('/api/admin/users'),

  // Get system stats
  getStats: () => apiCall('/api/admin/stats'),

  // Update user role
  updateUserRole: (userId, role) => apiCall(`/api/admin/users/${userId}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role })
  })
};

export default { todoAPI, authAPI, adminAPI };