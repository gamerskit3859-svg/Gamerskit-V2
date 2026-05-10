# OAuth & Role-Based Authentication Implementation

## Summary

I've implemented a complete OAuth authentication system with Google and Facebook login, along with comprehensive role-based access control (RBAC) for three user types: customers, staff, and admins.

## What Was Added

### Backend Changes (API)

#### 1. **User Model Updates**
- Added `googleId` and `facebookId` fields for OAuth provider linkage
- Added `avatar` field for OAuth provider avatars
- Made `passwordHash` optional (OAuth users don't need passwords)
- Added comprehensive `UserDocument` interface

**File**: [src/models/User.ts](api/src/models/User.ts)

#### 2. **Authentication Routes**
- `POST /api/auth/register` - Traditional email/password registration
- `POST /api/auth/login` - Traditional email/password login
- `POST /api/auth/oauth/google` - Google OAuth login/registration
- `POST /api/auth/oauth/facebook` - Facebook OAuth login/registration
- `GET /api/auth/me` - Get current user profile
- `GET /api/auth/orders` - Get user's orders

**File**: [src/routes/auth.ts](api/src/routes/auth.ts)

#### 3. **Admin User Management Routes**
- `GET /api/admin/users` - List all users (paginated)
- `GET /api/admin/users/:id` - Get user details
- `PATCH /api/admin/users/:id/role` - Update user role
- `DELETE /api/admin/users/:id` - Delete user

**File**: [src/routes/admin-users.ts](api/src/routes/admin-users.ts)

#### 4. **Enhanced Auth Middleware**
Added new role-based middleware functions:
- `adminRequired()` - Requires admin or staff role
- `staffRequired()` - Requires staff role only
- `adminOnlyRequired()` - Requires admin role only
- `roleRequired(roles)` - Custom role validation

**File**: [src/lib/auth.ts](api/src/lib/auth.ts)

### Frontend Changes (Web App)

#### 1. **Login Page Enhancement**
- Added Google login button
- Added Facebook login button
- Kept traditional email/password form
- Automatic role-based routing

**Features**:
- Google button uses `@react-oauth/google` library
- Facebook login redirects to Facebook OAuth dialog
- Smooth transition between social and traditional login

**File**: [src/app/account/login/page.tsx](web/src/app/account/login/page.tsx)

#### 2. **Auth Provider Setup**
- Created `AuthProviders` component to wrap app with GoogleOAuthProvider
- Wraps entire app layout for OAuth functionality

**File**: [src/components/AuthProviders.tsx](web/src/components/AuthProviders.tsx)

#### 3. **Admin Users Management Page**
- Complete user listing interface
- User role management modal
- Role badges with color coding:
  - Red: Admin
  - Blue: Staff
  - Gray: Customer
- User join date and email display

**File**: [src/app/admin/users/page.tsx](web/src/app/admin/users/page.tsx)

#### 4. **API Client Methods**
- `api.loginGoogle()` - Google OAuth login
- `api.loginFacebook()` - Facebook OAuth login

**File**: [src/lib/api.ts](web/src/lib/api.ts)

#### 5. **Admin Navigation**
- Added "Users & Roles" link to admin sidebar

**File**: [src/components/admin/AdminShell.tsx](web/src/components/admin/AdminShell.tsx)

## Configuration Required

### Step 1: Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable "Google Identity" API
4. Create OAuth 2.0 credentials (Web Application)
5. Add authorized redirect URIs:
   - `http://localhost:3000` (development)
   - `https://yourdomain.com` (production)
6. Copy Client ID

### Step 2: Facebook OAuth Setup

1. Go to [Facebook Developers](https://developers.facebook.com)
2. Create a new app (Consumer type)
3. Add "Facebook Login" product
4. Under Settings → Basic, copy App ID and App Secret
5. Under Facebook Login → Settings, add Valid OAuth Redirect URIs:
   - `http://localhost:3000/account/login` (development)
   - `https://yourdomain.com/account/login` (production)

### Step 3: Environment Variables

**API (.env)**:
```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
JWT_SECRET=your_secure_secret_key
```

**Web (.env.local)**:
```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
NEXT_PUBLIC_FACEBOOK_APP_ID=your_facebook_app_id
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## User Roles & Permissions

### Customer
- Default role for new users
- Can place orders
- Can view their order history
- Can update profile

### Staff
- Can view all orders
- Can manage inventory
- Can view reports
- Cannot manage users or access admin settings

### Admin
- Full system access
- Can manage all users
- Can change user roles
- Can manage inventory, orders, products, categories
- Can generate reports

## How It Works

### Social Login Flow
1. User clicks "Sign in with Google/Facebook"
2. OAuth provider authenticates user
3. User approves app access
4. OAuth provider sends user profile to frontend
5. Frontend sends profile to `/api/auth/oauth/{provider}`
6. Backend creates or updates user account
7. Backend returns JWT token
8. Frontend stores token in localStorage
9. User is redirected based on role:
   - Customer → `/account`
   - Staff/Admin → `/admin`

### Traditional Login Flow
1. User enters email and password
2. Frontend sends credentials to `/api/auth/login`
3. Backend validates and returns JWT token
4. Frontend stores token and redirects based on role

### Account Linking
If a user logs in via OAuth with an email that matches an existing account:
- OAuth provider ID is linked to existing account
- User avatar is updated if available
- No new account is created

## Testing

### Test with Default Admin
```bash
Email: admin@gamerskit.local
Password: admin123
```

### Create Test Users
1. Register a new account via email/password
2. Go to `/admin/users`
3. Change user role to "staff" or "admin"
4. Verify user can access admin features

### Test OAuth Login
1. Setup Google/Facebook OAuth credentials
2. Click "Sign in with Google/Facebook"
3. Complete OAuth flow
4. Verify user is created and logged in

## API Response Examples

### Login Response
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "customer"
  }
}
```

### User List Response
```json
{
  "items": [
    {
      "id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "customer",
      "avatar": "https://...",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 20
}
```

## Security Features

- **Password Hashing**: Bcrypt with 10 rounds
- **JWT Expiration**: 30 days
- **CORS Protection**: Configured for specific origins
- **OAuth Validation**: Verified against provider
- **Role-Based Access**: All admin endpoints require proper role
- **Account Linking**: Prevents duplicate accounts with same email

## Files Modified/Created

### Backend (API)
- ✅ [src/models/User.ts](api/src/models/User.ts) - Updated
- ✅ [src/lib/auth.ts](api/src/lib/auth.ts) - Enhanced
- ✅ [src/routes/auth.ts](api/src/routes/auth.ts) - Updated
- ✅ [src/routes/admin-users.ts](api/src/routes/admin-users.ts) - Created
- ✅ [src/env.ts](api/src/env.ts) - Updated
- ✅ [src/index.ts](api/src/index.ts) - Updated
- ✅ [.env.example](.env.example) - Updated

### Frontend (Web)
- ✅ [src/app/account/login/page.tsx](web/src/app/account/login/page.tsx) - Updated
- ✅ [src/app/layout.tsx](web/src/app/layout.tsx) - Updated
- ✅ [src/components/AuthProviders.tsx](web/src/components/AuthProviders.tsx) - Created
- ✅ [src/app/admin/users/page.tsx](web/src/app/admin/users/page.tsx) - Created
- ✅ [src/lib/api.ts](web/src/lib/api.ts) - Updated
- ✅ [src/components/admin/AdminShell.tsx](web/src/components/admin/AdminShell.tsx) - Updated
- ✅ [.env.example](.env.example) - Created

## Builds

Both the API and web app compile successfully:
- ✅ API build: `npm run build`
- ✅ Web build: `npm run build`

## Next Steps

1. **Configure OAuth Credentials**
   - Get Google Client ID from Google Cloud Console
   - Get Facebook App ID from Facebook Developers
   - Add to `.env` and `.env.local`

2. **Test Social Login**
   - Run dev servers: `npm run dev` in both apps
   - Test Google login
   - Test Facebook login
   - Verify account creation

3. **Manage Users**
   - Go to `/admin/users`
   - Create staff/admin users for your team
   - Test role-based access

4. **Deploy**
   - Update OAuth redirect URIs for production domain
   - Set secure JWT_SECRET in production
   - Configure production database

## Support

For questions or issues, refer to:
- [OAUTH_SETUP.md](OAUTH_SETUP.md) - Detailed OAuth setup guide
- [Google OAuth Docs](https://developers.google.com/identity/protocols/oauth2)
- [Facebook OAuth Docs](https://developers.facebook.com/docs/facebook-login)
