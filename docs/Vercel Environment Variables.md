# Vercel Environment Variables

Set these in the correct Vercel project, then redeploy that project. Do not put
backend secrets in the frontend project.

## Backend API project

Project: `ems-api-neon.vercel.app`

```env
NODE_ENV=production
DATABASE_URL=postgresql://<user>:<password>@<host>-pooler.<region>.neon.tech/<dbname>?sslmode=require&pgbouncer=true
DIRECT_URL=postgresql://<user>:<password>@<host>.<region>.neon.tech/<dbname>?sslmode=require
REDIS_URL=rediss://default:<token>@<host>.upstash.io:6379

JWT_SECRET=<64-byte-random-hex>
JWT_REFRESH_SECRET=<different-64-byte-random-hex>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
ENCRYPTION_KEY=<32-char-random-hex>

FRONTEND_URL=https://ems.nexgenpharmasolutions.com
CORS_ALLOWED_ORIGINS=https://ems.nexgenpharmasolutions.com,https://<your-web-project>.vercel.app

RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@nexgenpharmasolutions.com
RESEND_FROM_NAME=NexGen Pharma EMS

STORAGE_DRIVER=s3
AWS_REGION=auto
AWS_ACCESS_KEY_ID=<storage-access-key>
AWS_SECRET_ACCESS_KEY=<storage-secret-key>
S3_BUCKET_NAME=nexgen-ems-prod
AWS_ENDPOINT_URL=https://<account_id>.r2.cloudflarestorage.com

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

ALERT_MILD_DAYS=7
ALERT_MODERATE_DAYS=15
ALERT_CRITICAL_DAYS=30
ALERT_VISIT_DAYS=45
FOLLOWUP_THRESHOLD_MILD=7
FOLLOWUP_THRESHOLD_MODERATE=15
FOLLOWUP_THRESHOLD_CRITICAL=30

ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_REDIRECT_URI=
ZOHO_REFRESH_TOKEN=
WHATSAPP_API_KEY=
```

## Frontend web project

Project: `ems.nexgenpharmasolutions.com`

```env
NEXT_PUBLIC_API_URL=https://ems-api-neon.vercel.app
NEXT_PUBLIC_DEV_BYPASS=false
```

`NEXT_PUBLIC_API_URL` must not include `/api/v1`; the frontend client appends it.

## Removed face-service variables

Do not set these in Vercel anymore:

```env
FACE_SERVICE_URL
FR_SERVICE_URL
FACE_SERVICE_API_KEY
RECOGNITION_THRESHOLD
REKOGNITION_COLLECTION_ID
```

## Why the browser shows a CORS error

The frontend sends a preflight `OPTIONS` request before login. If the API
function crashes during startup because a required environment variable is
missing, Vercel returns a 500 response without CORS headers. The browser then
reports it as a CORS failure even though the root cause is usually API startup
failure or an incomplete CORS allowlist.
