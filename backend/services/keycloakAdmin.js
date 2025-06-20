const axios = require('axios');

class KeycloakAdminService {
  constructor() {
    this.baseURL = process.env.KEYCLOAK_URL || 'http://keycloak:8080';
    this.realm = process.env.KEYCLOAK_REALM || 'todo-realm';
    this.adminUsername = process.env.KEYCLOAK_ADMIN_USER || 'admin';
    this.adminPassword = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin123';
    this.clientId = 'admin-cli';
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async getAdminToken() {
    try {
      // Check if token is still valid
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      console.log('🔑 Getting Keycloak admin token...');
      
      const response = await axios.post(
        `${this.baseURL}/realms/master/protocol/openid-connect/token`,
        new URLSearchParams({
          grant_type: 'password',
          client_id: this.clientId,
          username: this.adminUsername,
          password: this.adminPassword
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000; // Refresh 1 minute early
      
      console.log('✅ Admin token obtained');
      return this.accessToken;
    } catch (error) {
      console.error('❌ Failed to get admin token:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with Keycloak admin');
    }
  }

  async getAuthHeaders() {
    const token = await this.getAdminToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  async getUserByUsername(username) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.get(
        `${this.baseURL}/admin/realms/${this.realm}/users?username=${encodeURIComponent(username)}`,
        { headers, timeout: 10000 }
      );
      
      return response.data.length > 0 ? response.data[0] : null;
    } catch (error) {
      console.error('❌ Failed to get user:', error.response?.data || error.message);
      throw new Error('Failed to fetch user from Keycloak');
    }
  }

  async getUserById(keycloakId) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.get(
        `${this.baseURL}/admin/realms/${this.realm}/users/${keycloakId}`,
        { headers, timeout: 10000 }
      );
      
      return response.data;
    } catch (error) {
      console.error('❌ Failed to get user by ID:', error.response?.data || error.message);
      throw new Error('Failed to fetch user from Keycloak');
    }
  }

  async getRealmRoles() {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.get(
        `${this.baseURL}/admin/realms/${this.realm}/roles`,
        { headers, timeout: 10000 }
      );
      
      return response.data;
    } catch (error) {
      console.error('❌ Failed to get realm roles:', error.response?.data || error.message);
      throw new Error('Failed to fetch realm roles');
    }
  }

  async getUserRoles(keycloakId) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.get(
        `${this.baseURL}/admin/realms/${this.realm}/users/${keycloakId}/role-mappings/realm`,
        { headers, timeout: 10000 }
      );
      
      return response.data;
    } catch (error) {
      console.error('❌ Failed to get user roles:', error.response?.data || error.message);
      throw new Error('Failed to fetch user roles');
    }
  }

  async assignRoleToUser(keycloakId, roleName) {
    try {
      const headers = await this.getAuthHeaders();
      
      // First, get the role details
      const rolesResponse = await axios.get(
        `${this.baseURL}/admin/realms/${this.realm}/roles`,
        { headers, timeout: 10000 }
      );
      
      const role = rolesResponse.data.find(r => r.name === roleName);
      if (!role) {
        throw new Error(`Role '${roleName}' not found in realm`);
      }

      // Assign the role
      await axios.post(
        `${this.baseURL}/admin/realms/${this.realm}/users/${keycloakId}/role-mappings/realm`,
        [role],
        { headers, timeout: 10000 }
      );
      
      console.log(`✅ Role '${roleName}' assigned to user ${keycloakId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to assign role:', error.response?.data || error.message);
      throw new Error(`Failed to assign role '${roleName}' to user`);
    }
  }

  async removeRoleFromUser(keycloakId, roleName) {
    try {
      const headers = await this.getAuthHeaders();
      
      // Get the role details
      const rolesResponse = await axios.get(
        `${this.baseURL}/admin/realms/${this.realm}/roles`,
        { headers, timeout: 10000 }
      );
      
      const role = rolesResponse.data.find(r => r.name === roleName);
      if (!role) {
        console.warn(`Role '${roleName}' not found in realm`);
        return true;
      }

      // Remove the role
      await axios.delete(
        `${this.baseURL}/admin/realms/${this.realm}/users/${keycloakId}/role-mappings/realm`,
        { 
          headers, 
          timeout: 10000,
          data: [role]
        }
      );
      
      console.log(`✅ Role '${roleName}' removed from user ${keycloakId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to remove role:', error.response?.data || error.message);
      throw new Error(`Failed to remove role '${roleName}' from user`);
    }
  }

  async updateUserRole(keycloakId, newRole) {
    try {
      console.log(`🔄 Updating user ${keycloakId} role to '${newRole}'...`);
      
      // Validate role
      if (!['user', 'admin'].includes(newRole)) {
        throw new Error('Invalid role. Must be "user" or "admin"');
      }

      // Get current user roles
      const currentRoles = await this.getUserRoles(keycloakId);
      const hasUserRole = currentRoles.some(r => r.name === 'user');
      const hasAdminRole = currentRoles.some(r => r.name === 'admin');

      // Remove existing roles
      if (hasUserRole) {
        await this.removeRoleFromUser(keycloakId, 'user');
      }
      if (hasAdminRole) {
        await this.removeRoleFromUser(keycloakId, 'admin');
      }

      // Assign new role
      await this.assignRoleToUser(keycloakId, newRole);
      
      console.log(`✅ User role updated successfully to '${newRole}'`);
      return true;
    } catch (error) {
      console.error('❌ Failed to update user role:', error.message);
      throw error;
    }
  }

  async getAllUsers() {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.get(
        `${this.baseURL}/admin/realms/${this.realm}/users?max=1000`,
        { headers, timeout: 15000 }
      );
      
      // Get roles for each user
      const usersWithRoles = await Promise.all(
        response.data.map(async (user) => {
          try {
            const roles = await this.getUserRoles(user.id);
            return {
              ...user,
              roles: roles.map(r => r.name)
            };
          } catch (error) {
            console.warn(`Failed to get roles for user ${user.username}:`, error.message);
            return {
              ...user,
              roles: []
            };
          }
        })
      );
      
      return usersWithRoles;
    } catch (error) {
      console.error('❌ Failed to get all users:', error.response?.data || error.message);
      throw new Error('Failed to fetch users from Keycloak');
    }
  }

  async ensureRolesExist() {
    try {
      console.log('🔧 Ensuring required roles exist in Keycloak...');
      
      const headers = await this.getAuthHeaders();
      const existingRoles = await this.getRealmRoles();
      
      const requiredRoles = ['user', 'admin'];
      const existingRoleNames = existingRoles.map(r => r.name);
      
      for (const roleName of requiredRoles) {
        if (!existingRoleNames.includes(roleName)) {
          console.log(`Creating missing role: ${roleName}`);
          await axios.post(
            `${this.baseURL}/admin/realms/${this.realm}/roles`,
            {
              name: roleName,
              description: `${roleName.charAt(0).toUpperCase() + roleName.slice(1)} role for Todo App`
            },
            { headers, timeout: 10000 }
          );
        }
      }
      
      console.log('✅ All required roles exist');
    } catch (error) {
      console.error('❌ Failed to ensure roles exist:', error.message);
      throw error;
    }
  }
}

module.exports = new KeycloakAdminService();