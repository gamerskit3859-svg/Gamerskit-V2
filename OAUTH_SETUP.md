# OAuth & Role-Based Authentication Setup Guide

This guide explains the newly implemented Facebook login, Google login, and role-based authentication system.

## Features Implemented

### 1. **OAuth Social Login**
- **Google Login**: Users can sign in with their Google account
- **Facebook Login**: Users can sign in with their Facebook account
- **Account Linking**: If a user logs in via OAuth with an email that matches an existing account, the OAuth provider is linked to that account

### 2. **Role-Based Access Control (RBAC)**
Three user roles are available:
- **Customer** (default): Regular user account for placing orders
- **Staff**: Can manage inventory, orders, and view reports
- **Admin**: Full access to all features including user management

### 3. **User Management**
- Admins can view all users in the system
- Admins can change user roles
- Users created via OAuth don't need passwords
- Users can link multiple OAuth providers to one account

## Backend Setup

### Environment Variables

Add these to your `.env` file:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Facebook OAuth  
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret

# JWT Secret (keep secure)
JWT_SECRET=your_secure_secret_key
```

### API Endpoints

#### Authentication
- `POST /api/auth/register` - Register with email/password
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/oauth/google` - Login/register with Google
- `POST /api/auth/oauth/facebook` - Login/register with Facebook
- `GET /api/auth/me` - Get current user (requires auth token)

#### User Management (Admin Only)
- `GET /api/admin/users` - List all users
- `GET /api/admin/users/:id` - Get user details
- `PATCH /api/admin/users/:id/role` - Update user role
- `DELETE /api/admin/users/:id` - Delete user

### User Model Schema

```typescript
{
  email: string (unique)
  name: string
  phone?: string
  avatar?: string (from OAuth providers)
  passwordHash?: string (optional for OAuth users)
  googleId?: string (unique)
  facebookId?: string (unique)
  role: "customer" | "staff" | "admin"
  createdAt: Date
  updatedAt: Date
}
```

## Frontend Setup

### Environment Variables

Add these to your `.env.local` file:

```bash
# Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=https://gamerskit-frontend.vercel.app/auth/google/callback

# Facebook OAuth
NEXT_PUBLIC_FACEBOOK_APP_ID=your_facebook_app_id

# API URL
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### Components

#### Login Page (`/account/login`)
- Email/password login form
- Google login button
- Facebook login button
- Automatic role-based routing (admins → dashboard)

#### Admin Users Page (`/admin/users`)
- List all users with their roles
- Modal to change user roles
- User creation date and email display

### Role-Based Access Guards

The system uses middleware to protect routes:
- `authRequired` - Requires authentication
- `adminRequired` - Requires admin or staff role
- `adminOnlyRequired` - Requires admin role only
- `staffRequired` - Requires staff role
- `roleRequired(roles)` - Custom role validation

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable Google Identity API
4. Create OAuth 2.0 credentials (Web Application type)
5. Add redirect URIs:
   - `http://localhost:3000/account/login` (development)
   - `https://yourdomain.com/account/login` (production)
6. Copy Client ID and Client Secret to `.env`

## Facebook OAuth Setup

1. Go to [Facebook Developers](https://developers.facebook.com)
2. Create a new app
3. Choose "Consumer" as app type
4. Add Facebook Login product
5. Configure OAuth redirect URIs:
   - `http://localhost:3000/account/login` (development)
   - `https://yourdomain.com/account/login` (production)
6. Copy App ID and App Secret to `.env`

## API Response Format

### Login Response
```json
{
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "User Name",
    "role": "customer" | "staff" | "admin"
  }
}
```

### User List Response
```json
{
  "items": [
    {
      "id": "user_id",
      "email": "user@example.com",
      "name": "User Name",
      "role": "customer",
      "avatar": "url_to_avatar",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 20
}
```

## Authentication Flow

### Social Login Flow
1. User clicks "Sign in with Google/Facebook"
2. OAuth provider returns user credentials
3. Frontend sends credentials to `/api/auth/oauth/{provider}`
4. Backend creates or updates user account
5. Backend returns JWT token
6. Frontend stores token and redirects based on role

### Role-Based Routing
- **Customer users** → Redirect to `/account`
- **Staff/Admin users** → Redirect to `/admin`

## Testing

### Test Credentials
Use the admin bootstrap user:
- Email: `admin@gamerskit.local`
- Password: `admin123`

### Manual Testing
1. Register a new account via email/password
2. Create a Google/Facebook developer app
3. Test social login on the login page
4. Change user role via admin panel
5. Verify access control on different pages

## Security Notes

- JWTs expire after 30 days
- Passwords are hashed with bcrypt (10 rounds)
- OAuth tokens are validated on the OAuth provider side
- Admin endpoints require valid JWT token with admin role
- CORS is configured to restrict origins in production

## Troubleshooting

### OAuth Returns 401
- Check `GOOGLE_CLIENT_ID` / `FACEBOOK_APP_ID` are correct
- Verify redirect URIs match exactly in OAuth provider settings
- Check that tokens are being sent with `Bearer` prefix

### Users can't access admin
- Verify user role is set to "admin" or "staff"
- Check JWT token is valid (expires in 30 days)
- Ensure `Authorization` header format is `Bearer {token}`

### OAuth user has no name/avatar
- Some OAuth providers don't return full profile
- Update user manually via admin panel
- Consider requesting additional OAuth scopes

## Next Steps

1. Configure OAuth credentials for development
2. Test social login flows
3. Create staff and admin users via admin panel
4. Set up production OAuth credentials
5. Configure CORS for production domain
