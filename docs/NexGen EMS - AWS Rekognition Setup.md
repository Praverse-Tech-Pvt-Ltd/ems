---
title: NexGen EMS - AWS Rekognition Setup
tags:
  - nexgen
  - aws
  - rekognition
  - face-recognition
date: 2026-05-18
---

# AWS Rekognition Setup

← [[NexGen EMS - Overview|Overview]] | [[NexGen EMS - Architecture|Architecture]]

---

> [!info] Why Rekognition?
> Replaced DeepFace + TensorFlow. Face service image went from **~3 GB → ~200 MB**, cold-start from **2–3 minutes → ~5 seconds**.

---

## Step 1 — Create IAM User

1. Go to [AWS Console → IAM → Users](https://console.aws.amazon.com/iam/home#/users)
2. Click **Create user**
3. Name: `nexgen-face-service` (or any name)
4. Select **Attach policies directly**
5. Search and attach: **`AmazonRekognitionFullAccess`**
6. Click **Create user**

---

## Step 2 — Generate Access Key

1. Open the user you just created
2. Go to **Security credentials** tab
3. Click **Create access key**
4. Use case: **Application running outside AWS**
5. Copy both values — you won't see the secret again:

```
AWS_ACCESS_KEY_ID     = AKIA...
AWS_SECRET_ACCESS_KEY = xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Step 3 — Add Keys to Environment

Edit `apps/face-service/.env`:

```env
DATABASE_URL=postgresql://neondb_owner:npg_5c8uRmbMzxNj@ep-mute-meadow-ao8beta1.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
AWS_ACCESS_KEY_ID=AKIA...your key
AWS_SECRET_ACCESS_KEY=your+secret
AWS_REGION=ap-south-1
REKOGNITION_COLLECTION_ID=nexgen-employees
```

> [!tip] Collection is auto-created
> The Rekognition collection (`nexgen-employees`) is created automatically on the **first enroll call** — no manual AWS Console steps needed.

---

## Region Reference

| Region | Code |
|--------|------|
| Mumbai (recommended for India) | `ap-south-1` |
| Singapore | `ap-southeast-1` |
| US East (N. Virginia) | `us-east-1` |
| EU (Ireland) | `eu-west-1` |

> [!warning] Match your region
> Use the same region in `AWS_REGION` as the one you used when creating the IAM user. Rekognition collections are region-scoped.

---

## How It Works

```mermaid
graph LR
    Enroll["POST /enroll\n{ employee_id, frames[] }"]
    Verify["POST /verify\n{ employee_id, face_image }"]
    Index["rekognition\n.index_faces()"]
    Search["rekognition\n.search_faces_by_image()"]
    DB[("Neon DB\nface_embedding JSONB")]
    Collection[("Rekognition\nCollection\nnexgen-employees")]

    Enroll --> Index --> Collection
    Index -->|store FaceId| DB
    Verify --> Search --> Collection
    Search -->|compare FaceId| DB
```

### Enrollment Flow
1. Capture 5 JPEG frames from webcam
2. `POST /enroll` with frames + `employee_id`
3. Face service calls `index_faces()` — Rekognition detects and indexes the face
4. Returned `FaceId` (UUID) saved to `employees.face_embedding` as `{"rekognition_face_id": "..."}`
5. `employees.face_enrolled` set to `true`

### Verification Flow
1. Capture 1 JPEG frame at punch-in
2. API calls `POST /verify` on face service
3. Face service calls `search_faces_by_image()` with **80% similarity threshold**
4. Compares matched `FaceId` against stored ID for that employee
5. Returns `{ verified, confidence, reason }`

> [!note] Soft Verification
> If the face service is unreachable or returns an error, the API **still allows punch-in** (logs confidence as `null`). Hard rejection only happens when FR is up AND similarity is confirmed low.

---

## Thresholds

| Parameter | Value | Notes |
|-----------|-------|-------|
| Rekognition search threshold | 70% | Pre-filter — Rekognition won't return matches below this |
| App similarity threshold | 80% | Final gate — punch rejected if below this |

---

## Pricing

| Tier | Calls | Cost |
|------|-------|------|
| Free (first 12 months) | 5,000/month | $0 |
| After free tier | Per call | ~$0.001 (~₹0.08) |

For a 50-employee company doing 2 punches/day → ~3,000 calls/month → **stays free**.

---

## Database Schema

Face data lives in the `employees` table — no separate table:

```sql
face_embedding   JSONB     -- {"rekognition_face_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}
face_enrolled    BOOLEAN   -- true once enrollment succeeds
```

To reset all face data (forces re-enrollment for everyone):

```sql
UPDATE employees SET face_embedding = NULL, face_enrolled = FALSE;
```

---

## Troubleshooting

> [!bug] `ValidationException: Request has invalid parameters`
> Image sent to Rekognition is malformed. The face service normalises to JPEG via Pillow — check the base64 payload is valid.

> [!bug] `InvalidParameterException: No face detected`
> No face found in the frame. The verification route returns `{ verified: false, confidence: 0.0 }` gracefully — not a 500 error.

> [!bug] `ResourceNotFoundException` on collection
> Collection doesn't exist yet. Call `ensure_collection()` — it's called automatically on every enroll/verify. Check `AWS_REGION` matches where you expect the collection.

> [!bug] `AccessDeniedException`
> IAM user missing `AmazonRekognitionFullAccess` policy, or wrong `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`.
