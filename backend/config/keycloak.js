const { createRemoteJWKSet } = require('jose');

const realm = process.env.KEYCLOAK_REALM || 'todo-realm';
const jwksUri = `http://keycloak:8080/realms/${realm}/protocol/openid-connect/certs`;
const JWKS = createRemoteJWKSet(new URL(jwksUri));

module.exports = { realm, JWKS };