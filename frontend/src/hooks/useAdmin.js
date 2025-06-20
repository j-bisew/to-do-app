import { useState, useCallback } from 'react';
import { adminAPI } from '../services/api';

export const useAdmin = (onAuthError, onMessage) => {
  const [adminData, setAdminData] = useState({ users: [], stats: {} });
  const [showAdmin, setShowAdmin] = useState(false);

  // Load admin data
  const loadAdminData = useCallback(async () => {
    try {
      const [users, stats] = await Promise.all([
        adminAPI.getUsers(),
        adminAPI.getStats()
      ]);

      setAdminData({
        users: Array.isArray(users) ? users : [],
        stats: stats || {}
      });
    } catch (error) {
      console.error('Failed to load admin data:', error);
      if (error.message === 'AUTH_ERROR') {
        onAuthError('Admin access denied. Please login again.');
      } else {
        onMessage('Failed to load admin data');
      }
    }
  }, [onAuthError, onMessage]);

  // Change user role
  const changeUserRole = useCallback(async (userId, newRole) => {
    try {
      await adminAPI.updateUserRole(userId, newRole);
      onMessage(`User role updated to ${newRole}`);
      await loadAdminData();
    } catch (error) {
      console.error('Failed to update user role:', error);
      if (error.message === 'AUTH_ERROR') {
        onAuthError('Admin access denied. Please login again.');
      } else {
        onMessage('Failed to update user role');
      }
    }
  }, [loadAdminData, onAuthError, onMessage]);

  // Toggle admin panel
  const toggleAdminPanel = useCallback((isAdmin) => {
    setShowAdmin(!showAdmin);
    if (!showAdmin && isAdmin) {
      loadAdminData();
    }
  }, [showAdmin, loadAdminData]);

  return {
    adminData,
    showAdmin,
    loadAdminData,
    changeUserRole,
    toggleAdminPanel
  };
};