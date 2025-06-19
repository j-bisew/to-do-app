-- 00-keycloak-db.sql - Create Keycloak database first

-- Create Keycloak database
CREATE DATABASE keycloak;

-- Create user if not exists and grant privileges
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'todouser') THEN
        CREATE USER todouser WITH PASSWORD 'todopass123';
    END IF;
END
$$;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE keycloak TO todouser;
GRANT ALL PRIVILEGES ON DATABASE todoapp TO todouser;