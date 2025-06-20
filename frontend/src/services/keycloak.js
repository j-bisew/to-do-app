import Keycloak from 'keycloak-js';

const keycloakConfig = {
  url: process.env.REACT_APP_KEYCLOAK_URL || 'http://localhost:8080',
  realm: process.env.REACT_APP_KEYCLOAK_REALM || 'todo-realm',
  clientId: process.env.REACT_APP_KEYCLOAK_CLIENT_ID || 'todo-frontend'
};

const keycloak = new Keycloak(keycloakConfig);

export const initKeycloak = async () => {
  try {
    console.log('🔧 Initializing Keycloak...');
    const authenticated = await keycloak.init({
      onLoad: 'check-sso',
      silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
      pkceMethod: 'S256' // Enable PKCE
    });

    if (authenticated) {
      console.log('✅ User authenticated with Keycloak');
    } else {
      console.log('🔓 User not authenticated');
    }

    return authenticated;
  } catch (error) {
    console.error('❌ Keycloak initialization failed:', error);
    throw error;
  }
};

export const loadUserProfile = async () => {
  try {
    const userProfile = await keycloak.loadUserProfile();
    const roles = keycloak.realmAccess?.roles || [];
    
    return {
      id: keycloak.subject,
      username: userProfile.username,
      email: userProfile.email,
      firstName: userProfile.firstName,
      lastName: userProfile.lastName,
      roles: roles,
      isAdmin: roles.includes('admin')
    };
  } catch (error) {
    console.error('Failed to load user profile:', error);
    throw error;
  }
};

export const login = () => {
  keycloak.login({
    redirectUri: window.location.origin
  });
};

export const register = () => {
  keycloak.register({
    redirectUri: window.location.origin
  });
};

export const logout = () => {
  keycloak.logout({
    redirectUri: window.location.origin
  });
};

export const getAuthHeaders = async () => {
  if (!keycloak.authenticated) {
    throw new Error('Not authenticated');
  }

  try {
    await keycloak.updateToken(30);
    return { 'Authorization': `Bearer ${keycloak.token}` };
  } catch (error) {
    console.error('❌ Failed to refresh token:', error);
    throw error;
  }
};

export const setupTokenRefresh = (onError) => {
  setInterval(() => {
    keycloak.updateToken(70).then((refreshed) => {
      if (refreshed) {
        console.log('🔄 Token refreshed');
      }
    }).catch(() => {
      console.log('❌ Failed to refresh token');
      onError('Session expired. Please login again.');
    });
  }, 60000);
};

export const isAuthenticated = () => keycloak.authenticated;

export default keycloak;