# Keycloak Configuration

Ten folder zawiera gotową konfigurację Keycloak realm dla Todo App.

## 📁 Struktura

```
keycloak/
├── todo-realm.json    # Eksport realm z konfiguracją
└── README.md         # Ten plik
```

## 🔧 Automatyczny import

Keycloak automatycznie zaimportuje realm przy starcie dzięki:
- Volume mount: `./keycloak:/opt/keycloak/data/import:ro`
- Command: `start-dev --import-realm`

## 👥 Prekonfigurowane użytkownicy

### Admin User
- **Username**: `admin`
- **Password**: `admin123`
- **Email**: `admin@todoapp.local`
- **Roles**: `admin`, `user`
- **Permissions**: Pełny dostęp + Admin Panel

### Demo User  
- **Username**: `demo`
- **Password**: `demo123`
- **Email**: `demo@todoapp.local`
- **Roles**: `user`
- **Permissions**: Standardowy użytkownik

## 🔐 Klienci OAuth2

### todo-frontend
- **Type**: Public Client
- **PKCE**: Enabled (S256)
- **Redirect URIs**: 
  - `http://localhost:3000/*`
  - `http://127.0.0.1:3000/*`
- **Web Origins**: 
  - `http://localhost:3000`
  - `http://127.0.0.1:3000`

### todo-backend
- **Type**: Confidential Client (Bearer-only)
- **Secret**: `your-backend-client-secret-change-in-production`
- **Service Account**: Enabled
- **Purpose**: JWT token verification

## 🎯 Funkcje realm

✅ **Rejestracja**: Włączona dla nowych użytkowników  
✅ **Login z email**: Można logować się emailem lub username  
✅ **Remember Me**: Zapamiętywanie sesji  
✅ **Reset hasła**: Funkcja odzyskiwania hasła  
✅ **Brute Force Protection**: Ochrona przed atakami  
✅ **Password Policy**: Minimum 8 znaków, wielkie/małe litery, cyfry  
✅ **Events Logging**: Logowanie zdarzeń bezpieczeństwa  

## 🔒 Bezpieczeństwo

- **Password Policy**: `length(8) and digits(1) and lowerCase(1) and upperCase(1)`
- **Session Timeout**: 30 minut bezczynności
- **Token Lifetime**: 5 minut (access token)
- **Brute Force**: 30 niepowodzeń = blokada konta
- **PKCE**: Wymagane dla public clients

## 🌐 Mapowania tokenów

Skonfigurowane protocol mappers dla JWT:
- `preferred_username` → username
- `email` → email  
- `given_name` → firstName
- `family_name` → lastName
- `realm_access.roles` → role użytkownika

## 📊 Admin Console

Dostęp: http://localhost:8080/admin
- **Master realm admin**: `admin` / `admin123`
- **Todo realm**: `todo-realm`

## 🔄 Regeneracja konfiguracji

Jeśli chcesz zaktualizować konfigurację:

1. Uruchom Keycloak
2. Skonfiguruj realm przez Admin Console
3. Wyeksportuj realm:
   ```bash
   docker exec -it todo-keycloak /opt/keycloak/bin/kc.sh export \
     --realm todo-realm \
     --file /tmp/todo-realm.json \
     --users realm_file
   ```
4. Skopiuj plik z kontenera:
   ```bash
   docker cp todo-keycloak:/tmp/todo-realm.json ./keycloak/
   ```

## 🚀 Testowanie

### Sprawdź endpoint OIDC:
```bash
curl http://localhost:8080/realms/todo-realm/.well-known/openid_configuration
```

### Sprawdź JWKS:
```bash
curl http://localhost:8080/realms/todo-realm/protocol/openid-connect/certs
```

### Test login flow:
1. Otwórz http://localhost:3000
2. Kliknij "Register" lub "Login"
3. Zostaniesz przekierowany do Keycloak
4. Po zalogowaniu wrócisz do aplikacji z tokenem

## 🎭 Role Management

### Realm Roles:
- **user**: Podstawowa rola dla wszystkich użytkowników
- **admin**: Administratorzy z dostępem do panelu admin

### Automatyczne przypisanie:
- Nowi użytkownicy otrzymują rolę `user`
- Role `admin` trzeba przypisać ręcznie lub przez Admin Console

## 🔧 Troubleshooting

### Problem: Realm się nie importuje
```bash
# Sprawdź logi
docker-compose logs keycloak

# Sprawdź czy plik istnieje w kontenerze
docker exec todo-keycloak ls -la /opt/keycloak/data/import/
```

### Problem: Użytkownicy nie mogą się zalogować
1. Sprawdź czy realm jest enabled
2. Sprawdź czy użytkownicy są enabled
3. Sprawdź password policy
4. Sprawdź logi: `docker-compose logs keycloak`

### Problem: Frontend nie może się połączyć
1. Sprawdź redirect URIs w kliencie `todo-frontend`
2. Sprawdź Web Origins
3. Sprawdź czy realm jest dostępny: http://localhost:8080/realms/todo-realm

## 📝 Notatki dla prowadzącego

- **Import automatyczny**: Realm importuje się przy każdym starcie
- **Persistence**: Dane Keycloak są zapisywane w volume `keycloak_data`
- **PKCE demonstracja**: Widoczne w Network tab przeglądarki
- **Role-based access**: Admin widzi panel admin, user nie
- **Production ready**: Wszystkie security headers skonfigurowane