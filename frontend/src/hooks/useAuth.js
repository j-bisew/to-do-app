import { useState, useEffect } from 'react';
import { initKeycloak, loadUserProfile, setupTokenRefresh, isAuthenticated } from '../services/keycloak';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [keycloakInitialized, setKeycloakInitialized] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const initAuth = async () => {
      try {
        const authenticated = await initKeycloak();
        setKeycloakInitialized(true);

        if (authenticated) {
          const userProfile = await loadUserProfile();
          setUser(userProfile);
          console.log('👤 User loaded:', userProfile.username, 'Roles:', userProfile.roles);
        } else {
          setAuthError('');
        }

        setupTokenRefresh((error) => {
          setAuthError(error);
        });

      } catch (error) {
        console.error('❌ Authentication initialization failed:', error);
        setKeycloakInitialized(true);
        setAuthError('Failed to initialize authentication. Please refresh the page.');
      }
    };

    initAuth();
  }, []);

  useEffect(() => {
    if (authError) {
      const timer = setTimeout(() => setAuthError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [authError]);

  const clearAuthError = () => setAuthError('');

  return {
    user,
    keycloakInitialized,
    authError,
    isAuthenticated: isAuthenticated(),
    clearAuthError
  };
};