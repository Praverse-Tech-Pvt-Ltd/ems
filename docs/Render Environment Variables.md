# Render Environment Variables

Use these for the Render backend service. After Render creates the service URL,
set `RENDER_SELF_URL` to that URL and update the frontend `NEXT_PUBLIC_API_URL`
to the same URL without `/api/v1`.

## Backend API - Render

```env
NODE_ENV=production
PORT=3001

DATABASE_URL=postgresql://<user>:<password>@<host>-pooler.<region>.neon.tech/<dbname>?sslmode=require&pgbouncer=true
DIRECT_URL=postgresql://<user>:<password>@<host>.<region>.neon.tech/<dbname>?sslmode=require
REDIS_URL=rediss://default:<token>@<host>.upstash.io:6379

JWT_SECRET=<64-byte-random-hex>
JWT_REFRESH_SECRET=<different-64-byte-random-hex>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
ENCRYPTION_KEY=<32-char-random-hex>

FRONTEND_URL=https://ems.nexgenpharmasolutions.com
CORS_ALLOWED_ORIGINS=https://ems.nexgenpharmasolutions.com
RENDER_SELF_URL=https://<your-render-api-service>.onrender.com

RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@nexgenpharmasolutions.com
RESEND_FROM_NAME=NexGen Pharma EMS

STORAGE_DRIVER=local
LOCAL_STORAGE_DIR=uploads

BCRYPT_ROUNDS=12
BCRYPT_OTP_ROUNDS=8
RATE_LIMIT_OTP_MAX=3
RATE_LIMIT_OTP_WINDOW=1800

OFFICE_LAT=28.6139
OFFICE_LNG=77.2090
OFFICE_RADIUS_METERS=200

GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
OWNER_EMPLOYEE_IDS=f2112547-5be0-4819-9d66-13996dc56581,b300bd45-0e53-41e6-a9bc-448f4c4dcd40
AI_CHAT_ENABLED=true
```

## Frontend Web App

Set this only after the Render backend URL is available:

```env
NEXT_PUBLIC_API_URL=https://<your-render-api-service>.onrender.com
NEXT_PUBLIC_DEV_BYPASS=false
```

`NEXT_PUBLIC_API_URL` must not include `/api/v1`; the frontend client appends it.

## Not Required

Do not set these anymore:

```env
FACE_SERVICE_URL
FR_SERVICE_URL
FACE_SERVICE_API_KEY
RECOGNITION_THRESHOLD
REKOGNITION_COLLECTION_ID
ZOHO_CLIENT_ID
ZOHO_CLIENT_SECRET
ZOHO_REDIRECT_URI
ZOHO_REFRESH_TOKEN
WHATSAPP_API_KEY
```
