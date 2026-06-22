# HealthMate + MediStaff HMS — Master Plan
**Scope:** Both products + Mennie Unified WebApp  
**Audience:** Full team — Pratham (AI/ML), Maanav (Backend), Dev (Frontend)  
**Date:** 2026-06-08  
**Codebase:** `D:\Mennie\`

---

# PART A — Mennie Unified WebApp (Steps 55–74)
## New app: `apps/mennie-web/`

**Vision:** Mennie is the single front door to the entire platform. It opens like a video call — full-screen, clean, nothing cluttering the view. The AI greets you by face. If it knows you, it routes you straight to your world (doctor or patient). If it doesn't know you, it introduces itself, listens, and captures your face for next time. Everything manual is hidden behind one hovering button that reveals itself only when needed.

### Architecture Overview
```
Browser opens mennie-web
        |
   Camera activates (with consent)
        |
   Mennie AI Avatar appears (video-chat style UI)
        |
   Face recognition runs in background
        |
   ┌─────────────┬──────────────────┐
   │ Face known  │  Face unknown    │
   │             │                  │
   ▼             ▼                  ▼
Doctor        Patient        New visitor →
Dashboard     Intake         Greeting → face
(MediStaff)   (HealthMate)   capture → route
```

**Tech Stack (new app):**
- Next.js 15 App Router
- TensorFlow.js + `face-api.js` — in-browser face detection and recognition (no data leaves device during detection)
- Framer Motion — entrance animations, avatar expressions, personality transitions
- Recharts — doctor dashboard data visualization
- Tailwind CSS with CSS variable–based dynamic theming (personality adaptation)
- Socket.io client — live queue updates for doctors (reuses existing medistaff-api socket)
- WebRTC via browser MediaDevices API — camera feed (no third-party video service needed for Phase 1)

---

### Step 55 | Owner: Dev | ID: MW-SETUP — Mennie Web App Scaffold

**Description:** Create `apps/mennie-web/` in the monorepo. This is a new Next.js 15 app — the unified entry point for the entire platform. It connects to both `healthmate-backend` and `medistaff-api`.

**Claude Code Prompt:**
> Create `apps/mennie-web/` as a Next.js 15 App Router project inside the existing pnpm Turborepo monorepo at `D:\Mennie\`. Setup: (1) pnpm workspace entry in `pnpm-workspace.yaml`, (2) `package.json` with name `mennie-web`, (3) Tailwind CSS v4 with CSS variable theming system — define base variables `--color-bg`, `--color-surface`, `--color-primary`, `--color-accent`, `--color-text` that can be swapped at runtime via JavaScript for personality adaptation, (4) Framer Motion for animations, (5) `face-api.js` and `@tensorflow/tfjs` as dependencies (face recognition, browser-side), (6) `recharts` for data visualization, (7) `socket.io-client` for live doctor queue updates, (8) Inter + DM Sans fonts (warm, human, readable — healthcare appropriate), (9) `middleware.ts` for JWT cookie check — routes `/doctor/*` require DOCTOR role, `/patient/*` require front_desk/patient role, unauthenticated → back to landing, (10) add `mennie-web` to `turbo.json` pipeline. Port: 3200.

---

### Step 56 | Owner: Dev | ID: MW-LANDING — Mennie Landing Page (Video-Chat Style UI)

**Description:** The landing page looks and feels like a video call. Full screen. Mennie avatar centred. User's camera feed in a small pip corner. Zero clutter. The entire interface disappears except for Mennie and the camera — no nav bar, no header, no footer.

**Claude Code Prompt:**
> Build `apps/mennie-web/app/page.tsx` — the Mennie landing experience. Layout: full-screen dark background (`#07090F`), no scrolling, no header/nav/footer. Components: (1) **MennieAvatar** — centred, 320×320px circular container with a soft animated glow ring (Framer Motion pulse, calm blue `#3B82F6`), avatar is a placeholder animated gradient orb for now (swap for real avatar asset later), (2) **UserCameraFeed** — small 160×120px pip in bottom-right corner, rounded corners, subtle border, shows the user's live camera feed (access via `navigator.mediaDevices.getUserMedia`), camera permission request handled gracefully with a text fallback if denied, (3) **MennieGreetingText** — below avatar, animated text that types in character by character (`"Hello, I'm Mennie."` then pauses, then `"Let me see who you are."`), Framer Motion staggered character animation, (4) A **loading indicator** replaces greeting text while face recognition is running. The page must feel like opening a video call — instant, warm, human. No buttons visible at this stage.

---

### Step 57 | Owner: Pratham | ID: MW-FACE-BE — Face Embedding Storage API

**Description:** Backend for face recognition. When Mennie meets a new person, their face embedding is stored against their user profile. When a returning person arrives, their embedding is matched to identify them.

**Claude Code Prompt:**
> In `apps/medistaff-api/src/`, add face recognition endpoints. First, add `faceEmbedding` field (JSON array of floats, nullable) to the `User` model in `packages/db/prisma/schema.prisma` and create a migration. Then implement: (1) `POST /auth/face/register` — accepts `{ embedding: number[], userId: string }`, requires ADMIN or the user's own JWT, stores the 128-float face embedding on the User record (replace if already exists), logs to AuditService `action_type: FACE_REGISTERED`, (2) `POST /auth/face/identify` — accepts `{ embedding: number[] }`, queries all users with non-null `faceEmbedding`, computes Euclidean distance between input and each stored embedding, returns the closest match if distance < 0.6 (threshold — configurable via env `FACE_MATCH_THRESHOLD`), returns `{ matched: bool, userId: string, role: string, name: string, accessToken: string }` if matched — generates a short-lived JWT on match, (3) `DELETE /auth/face/remove` — requires own JWT, removes `faceEmbedding` from the user. No raw face images are stored — only the 128-float embedding vector. Unit tests: match below threshold returns user, match above threshold returns `matched: false`, missing embedding returns `matched: false`.

---

### Step 58 | Owner: Pratham | ID: MW-FACE-FE — Face Recognition in Browser

**Description:** TensorFlow.js + face-api.js runs entirely in the browser. It detects and computes the face embedding client-side, then sends only the embedding vector to the backend — no face image ever leaves the device.

**Claude Code Prompt:**
> Create `apps/mennie-web/components/FaceRecognition/` with: (1) `useFaceRecognition.ts` — React hook that: loads face-api.js models from `/models/` (ssdMobilenetv1 + faceLandmark68Net + faceRecognitionNet), attaches to the camera video element ref, runs detection every 800ms using `faceapi.detectSingleFace().withFaceLandmarks().withFaceDescriptor()`, extracts the 128-float descriptor, POSTs to `POST /auth/face/identify`, on match → stores returned JWT in cookie `mennie_token` and calls `onIdentified(userId, role)`, on no match for 3 consecutive attempts → calls `onUnknown()`, (2) `FaceStatusIndicator.tsx` — small visual indicator showing recognition state: scanning (animated dots), recognised (green check fade-in), unknown (soft amber pulse — not alarming), (3) Model files must be served from `apps/mennie-web/public/models/` — add a download script `scripts/download-face-models.js` that fetches the face-api.js model weights from their CDN and saves them locally so the app works offline/on LAN. Hook into the landing page from Step 56 — recognition runs silently in background while Mennie's greeting animation plays.

---

### Step 59 | Owner: Dev | ID: MW-ROUTE — Role-Based Routing After Recognition

**Description:** Once face recognition identifies the person (or they log in manually), the app routes them to the right experience. Doctor → doctor dashboard. Patient/unknown → patient intake with Mennie.

**Claude Code Prompt:**
> In `apps/mennie-web/`, implement role-based routing triggered after face recognition or manual login. (1) Create `lib/auth.ts` — `getSessionFromCookie()` decodes the `mennie_token` JWT (use `jose` to verify RS256 signature with `JWT_PUBLIC_KEY` env var), returns `{ userId, role, name }`, (2) After `onIdentified(userId, role)` fires from the face recognition hook: if `role === 'DOCTOR'` or `role === 'NURSE'` → animate Mennie saying `"Welcome back, Dr. [name]."` with a warm transition, then `router.push('/doctor/dashboard')`, if `role === 'FRONT_DESK'` or `role === 'PATIENT'` → animate Mennie saying `"Hi [name], how are you feeling today?"` then `router.push('/patient/intake')`, (3) After `onUnknown()` fires: Mennie says `"I don't think we've met. I'm Mennie."` → transitions to new-visitor flow (Step 60), (4) Next.js `middleware.ts` enforces: `/doctor/*` requires DOCTOR/NURSE role in cookie, `/patient/*` requires any valid token, redirect to `/` on failure. The routing transition must feel like a conversation turning a corner — use Framer Motion `AnimatePresence` page transitions (slide or crossfade, 400ms).

---

### Step 60 | Owner: Dev | ID: MW-NEW-VISITOR — New Visitor Flow + Face Capture

**Description:** When Mennie doesn't recognise someone, it greets them, asks their name, listens, and captures their face for next time — all within the same video-chat-style interface.

**Claude Code Prompt:**
> Build `apps/mennie-web/app/visitor/page.tsx` — the new visitor onboarding flow. It is a linear conversation UI (like a chat with Mennie): (1) Mennie greets: `"I don't think we've met. I'm Mennie, your hospital assistant."`, (2) Mennie asks: `"Are you a patient or a staff member?"` — two large soft-button options appear below the avatar (`I'm a patient` / `I'm staff`), (3) For patient: Mennie asks for name → input field appears inline, on submit Mennie says `"Nice to meet you, [name]. I'll remember your face for next time."` → face capture runs (takes 3 frames, averages the embedding), POSTs to `POST /auth/face/register` with a guest token, then transitions to `GET /patient/intake`, (4) For staff: Mennie says `"Please use the login button to access staff features."` → triggers the manual login FAB (Step 61), (5) Each conversation step uses Framer Motion — Mennie's text types in, response options slide up, user response slides to the left and Mennie's reply appears. This should feel like a calm, friendly check-in — never clinical.

---

### Step 61 | Owner: Dev | ID: MW-FAB — Floating Action Button (Manual Options)

**Description:** The one button that is always there but never intrusive. It appears when the user hovers near the screen edge. It expands to reveal manual options — login, type a message, get help.

**Claude Code Prompt:**
> Build `apps/mennie-web/components/FAB/FloatingActionButton.tsx`. Behaviour: (1) Default state — a small (48px) semi-transparent circular button anchored bottom-right (24px from edges), icon is three soft dots or a gentle menu icon, `opacity: 0.3`, transitions to `opacity: 1` when the cursor enters within 120px of the button OR the cursor enters the bottom-right quadrant of the screen (use a `mousemove` listener), (2) Expanded state — on click, the FAB expands upward revealing 4 options with Framer Motion staggered slide-up: `[🔐 Login]` `[⌨️ Type a message]` `[❓ Get help]` `[⚙️ Settings]`, each option is a pill button with soft label, (3) Collapse — clicking outside or pressing Escape collapses back to the dot, (4) Login option opens `ManualLoginModal.tsx` — standard email + password form, on success sets `mennie_token` cookie and triggers the same role-routing as face recognition (Step 59), (5) Type a message opens an inline chat input below Mennie's avatar — the user can type instead of speak, input is forwarded to the HealthMate intake pipeline, (6) Get help shows a soft overlay with 3 options: `Call front desk`, `View hospital map`, `Accessibility mode`. FAB must be present on every page in the app via the root layout, not just the landing page.

---

### Step 62 | Owner: Dev | ID: MW-DOC-DASH — Doctor Dashboard Home

**Description:** When a doctor arrives, their world opens up — assigned patients, today's queue, pending AI summaries, renewals due. All data, no clutter. Beautiful, readable, actionable.

**Claude Code Prompt:**
> Build `apps/mennie-web/app/doctor/dashboard/page.tsx`. Layout: a calm dark dashboard (`#0A0F1E` background), sidebar collapsed to icon-only by default (expands on hover — same pattern as `medistaff-web`), main content area split into 4 sections: (1) **Today's Queue Card** — live patient count by priority (CRITICAL / HIGH / NORMAL / LOW) shown as 4 coloured number blocks, pulls from `GET /queue` on medistaff-api, updates via Socket.io `queue:updated` event, (2) **My Patients strip** — horizontal scroll of patient cards (each shows name, MRN, last visit date, chief complaint preview, urgency badge), pulls from `GET /patients?mine=true`, clicking a card goes to `/doctor/patients/[id]`, (3) **Pending AI Reviews badge** — count of visits with `AiCaseSummary.status = PENDING_REVIEW` assigned to this doctor, with a `Review Now` button, (4) **Renewals Due** — count of renewals due in ≤7 days, overdue count in red, link to renewals list. Mennie's avatar shrinks to a small badge in the top-left corner of the dashboard — still there, still warm, but out of the way. Greeting message from Mennie: `"Good morning, Dr. [name]. You have [X] patients waiting."` — plays once on entry via Framer Motion, then disappears.

---

### Step 63 | Owner: Dev | ID: MW-DOC-GRAPHS — Patient Data Visualisation

**Description:** The doctor's view of their patients — not a table but a living picture of their panel. Trends, urgency spread, renewals timeline. All automated from existing data in medistaff-api.

**Claude Code Prompt:**
> Build `apps/mennie-web/app/doctor/analytics/page.tsx` using Recharts. Include 5 visualisations, each in its own card: (1) **Visit Volume** — `AreaChart` showing number of visits per day for the last 30 days, smooth curve, filled with a gradient from `#3B82F6` to transparent, (2) **Urgency Distribution** — `PieChart` with 4 slices (CRITICAL=red, HIGH=orange, NORMAL=blue, LOW=grey), shows percentage labels inside each slice, pulls from `GET /visits?mine=true` and aggregates client-side, (3) **Top Chief Complaints** — `BarChart` horizontal showing top 8 chief complaints by frequency across the doctor's visits, bars in `#3B82F6`, sorted descending, (4) **Renewals Timeline** — `ScatterChart` showing each renewal as a dot on a date axis, colour by status (OVERDUE=red, DUE_SOON=amber, UPCOMING=green), (5) **AI Accuracy Trend** (if data available) — `LineChart` showing percentage of AI summaries the doctor approved vs overrode per week, helps the doctor see if the AI is improving. All charts are responsive (use Recharts `ResponsiveContainer`). Data fetched via TanStack Query with 5-minute stale time. Each chart has a subtle Framer Motion entrance (fade + slight upward slide, staggered 150ms apart).

---

### Step 64 | Owner: Dev | ID: MW-DOC-PATIENT — Doctor Patient Detail View

**Description:** The doctor's full view of one patient — demographics, visit history timeline, AI case summaries, prescriptions, renewals. Clean, readable, everything in one place.

**Claude Code Prompt:**
> Build `apps/mennie-web/app/doctor/patients/[id]/page.tsx`. Split layout at ≥1280px: left panel (35%) = patient card (name, MRN, ABHA masked, blood group, chronic conditions, allergy chips in red). Right panel (65%) = tabbed view with 3 tabs: (1) **Timeline tab** — vertical timeline of all visits (newest first), each visit shows date, chief complaint, urgency badge, AI summary status, doctor notes preview, clicking a visit expands the AI summary inline, (2) **Prescriptions tab** — list of all prescriptions with status (ACTIVE/EXPIRED/SIGNED), medicine names, link to sign/renew, (3) **Renewals tab** — due renewals for this patient with approve/reject actions. Mennie AI summary panel: when a visit is expanded, the AI case summary appears in a highlighted box with `AI Suggested` label on every field — same component as MediStaff Web `AISummaryPanel` (import from `packages/shared-types` or duplicate with Mennie styling). Action buttons: `Approve Summary`, `Override Field`, `Add Notes`. All API calls go to `medistaff-api`.

---

### Step 65 | Owner: Dev + Pratham | ID: MW-PAT-INTAKE — Patient Intake via Mennie (Voice + Text)

**Description:** The patient experience. Mennie asks questions. The patient speaks (or types). Mennie listens, processes through the HealthMate pipeline, and tells the patient where to go — all within the same video-chat style interface.

**Claude Code Prompt:**
> Build `apps/mennie-web/app/patient/intake/page.tsx`. This replaces the existing HealthMate kiosk intake with a conversational Mennie experience. Flow: (1) Mennie opens: `"Hi [name]. Tell me how you're feeling today, or describe what brought you in."`, (2) **Input modes**: a microphone button (hold to speak — Web Speech API `SpeechRecognition` for voice input, transcribed in real-time, shown as text below Mennie) AND a text input that appears when the user clicks the keyboard icon from the FAB, (3) On input received: show Mennie's "thinking" animation (soft pulsing ring), POST to `POST /api/v1/intake/start` on healthmate-backend, (4) While processing: Mennie says `"Let me check that for you."` with a gentle loading state, (5) On result: for RED urgency → Mennie's glow ring turns red, she says `"This sounds urgent. Please go to the Emergency Department right away, or ask any staff member for help immediately."` — large department name displayed below, (6) for YELLOW → `"I'll direct you to [Department]. Please let the front desk know you're here."` — soft amber ring, (7) for GREEN → `"Please head to [Department]. [Navigation if available from RAG]."` — soft green ring. Disclaimer always visible: `"Mennie helps you find the right department. She does not provide diagnosis or treatment advice."`. Framer Motion transitions between each conversation step.

---

### Step 66 | Owner: Pratham | ID: MW-AI-AVATAR — Mennie AI Avatar Expressions + Voice

**Description:** Mennie needs a personality — she speaks, she reacts, her visual state changes with the conversation. This step wires her expression system so she looks alive and responsive.

**Claude Code Prompt:**
> Create `apps/mennie-web/components/MennieAvatar/` with an expression + voice system. (1) `MennieAvatar.tsx` — the visual avatar. Phase 1 is an animated orb/waveform (no 3D model required). Use SVG + Framer Motion: a central circle with 6 orbiting particles that change speed/size based on state. States: `idle` (slow gentle pulse, blue), `listening` (particles pulse faster, colour shifts to teal, waveform indicator appears below), `thinking` (particles orbit faster, amber tint), `speaking` (waveform animates below avatar), `alert` (ring flashes red once then returns to amber for urgency warnings), `happy` (brief burst of small particles radiating outward — used on greeting a recognised person), (2) `useMennieVoice.ts` — hook wrapping `window.speechSynthesis`. `speak(text, emotion)` selects a voice (preferably a warm female en-IN or en-US voice), adjusts `rate` and `pitch` slightly by emotion (`greeting`=warm/slightly higher, `alert`=slower/lower, `normal`=default), returns a Promise that resolves when speech ends, (3) `MennieStateContext.tsx` — React context exposing `{ state, speak, setExpression }` so any page can make Mennie speak or change expression without prop-drilling. Wire into landing, visitor, and intake pages.

---

### Step 67 | Owner: Dev | ID: MW-THEME-ADAPT — Personality-Adaptive Theming

**Description:** The interface adapts to the person. Not based on games or entertainment — based on warmth and positivity. A new patient sees a calmer, more reassuring palette. A doctor's dashboard is focused and professional. A returning patient sees their "usual" Mennie with continuity.

**Claude Code Prompt:**
> Create `apps/mennie-web/lib/themeEngine.ts`. Theme logic: (1) Define 4 theme personas — `CALM` (soft blues, gentle gradients — for anxious/new patients), `WARM` (amber-tinted, slightly brighter — for returning patients Mennie knows well), `FOCUSED` (deep navy, crisp whites — for doctors and staff), `ACCESSIBLE` (high contrast, larger text, minimal animation — triggered by accessibility mode in FAB), (2) `applyTheme(persona: ThemePersona)` — writes CSS custom properties (`--color-bg`, `--color-primary`, etc.) to `document.documentElement`, wrapped in a smooth `transition: all 0.6s ease` so the shift is never jarring, (3) Theme selection logic: Doctor role → `FOCUSED` always; New visitor → `CALM`; Returning patient (recognised by face) → load their saved `themePreference` from user profile (stored in medistaff-api `User` table — add `themePreference` field to schema), default `WARM` if none saved; accessibility mode → `ACCESSIBLE`, (4) `ThemeProvider.tsx` — wraps the app in `_app` or root layout, exposes `useTheme()` hook, (5) Add `PATCH /profile/theme` endpoint in medistaff-api to save a user's theme preference. No animations should feel childish or game-like — all motion is purposeful and calm (easing curves: `ease-in-out`, max 500ms duration).

---

### Step 68 | Owner: Dev | ID: MW-MICRO-ANIM — Positive Environment Micro-Interactions

**Description:** The app feels alive and welcoming without being distracting. Subtle micro-interactions that make every action feel smooth and cared-for.

**Claude Code Prompt:**
> Implement micro-interactions across `apps/mennie-web/` using Framer Motion. (1) **Page transitions** — `AnimatePresence` in root layout wrapping every page. All transitions use `opacity: 0→1` + `y: 20→0` (gentle rise), duration 350ms, `ease: [0.25, 0.1, 0.25, 1]` (ease-out cubic), (2) **Card hover states** — all patient/visit cards: `scale: 1.01`, `boxShadow` brightens slightly on hover, 200ms ease, (3) **Button interactions** — all buttons: slight `scale: 0.97` on press (tap feedback), release springs back with `type: 'spring', stiffness: 400`, (4) **Urgency badge entrance** — RED badges: `scale: 0→1` with a single pulse after appearance (scale 1→1.1→1), YELLOW/GREEN: simple fade-in, (5) **Mennie greeting entrance on doctor dashboard** — greeting text fades in character by character using `staggerChildren: 0.03`, then fades out after 4 seconds automatically, (6) **Queue count changes** — when queue numbers update via Socket.io, the number flips with a subtle `y: -10→0` animation (like a ticker), (7) **NO confetti, NO party effects, NO game sounds** — this is healthcare. All motion signals care, calm, and competence. Every animation must have a `prefers-reduced-motion` media query fallback that disables it entirely.

---

### Step 69 | Owner: Maanav | ID: MW-API-BRIDGE — API Bridge: Mennie ↔ Both Backends

**Description:** Mennie web needs to talk to two backends — `healthmate-backend` (FastAPI, port 8000) for patient intake, and `medistaff-api` (Express, port 4100) for doctor features. A single API layer on the Mennie Next.js side handles the routing.

**Claude Code Prompt:**
> Create `apps/mennie-web/lib/api/` with two typed API clients: (1) `healthmateClient.ts` — wraps `fetch` with base URL from `NEXT_PUBLIC_HEALTHMATE_API_URL` env var, adds `Authorization: Bearer <token>` header from cookie, exports typed functions: `startIntake(payload)`, `getSession(id)`, `reviewSession(id, action)`, (2) `mediStaffClient.ts` — wraps `fetch` with base URL from `NEXT_PUBLIC_MEDISTAFF_API_URL`, same auth pattern, exports: `getQueue()`, `getPatients(params)`, `getVisit(id)`, `getAnalytics()`, `getRenewals()`, `approveRenewal(id)`, `identifyFace(embedding)`, `registerFace(embedding)`, (3) `useApi.ts` — TanStack Query wrappers for all of the above with appropriate stale times (queue: 0 = always fresh, patient list: 30s, analytics: 5min), (4) Add `NEXT_PUBLIC_HEALTHMATE_API_URL` and `NEXT_PUBLIC_MEDISTAFF_API_URL` to `apps/mennie-web/.env.example`. Also add CORS entries for `http://localhost:3200` in both backend apps' CORS configs (Step 35 already covers this pattern).

---

### Step 70 | Owner: Dev | ID: MW-MANUAL-LOGIN — Manual Login Modal (FAB Secondary Path)

**Description:** The manual login is the fallback — accessed via the FAB. It should feel like part of the Mennie conversation, not a separate portal.

**Claude Code Prompt:**
> Build `apps/mennie-web/components/FAB/ManualLoginModal.tsx`. It is NOT a full page — it's a modal that appears over the landing page without leaving the Mennie video-chat environment. Design: centred card (max 420px wide), dark surface `#111827`, rounded-2xl, Framer Motion `scale: 0.9→1 + opacity: 0→1` entrance (300ms). Content: (1) Small Mennie avatar at top of modal (48px orb, pulsing gently), (2) Heading: `"Staff login"` or `"Continue manually"`, (3) Email + Password fields (shadcn-style inputs, same design language as mennie-web), (4) Submit → `POST /auth/login` on medistaff-api → on success: set `mennie_token` cookie, close modal, trigger role routing (Step 59), (5) Error state: Mennie avatar briefly flashes amber, error text appears below fields (e.g. `"Those details don't match — please try again"`), (6) Below form: `"I'm a patient"` link → closes modal and starts visitor flow (Step 60) instead. The modal dismisses on outside click or Escape. No separate /login route — login is always contextual within the Mennie experience.

---

### Step 71 | Owner: Dev | ID: MW-PATIENT-RESULT — Patient Result + Wayfinding Screen

**Description:** After triage, the patient needs a clear result they can act on immediately — where to go, how to get there, what to say when they arrive.

**Claude Code Prompt:**
> Build `apps/mennie-web/app/patient/result/page.tsx` (or as a state within the intake page). Three urgency states: (1) **RED** — full Mennie screen turns to a calm-but-serious state (dark red ambient glow, NOT alarming flashing red — this must not panic an already anxious patient), Mennie speaks: `"This sounds urgent. Please go to the Emergency Department now. You can also press the emergency button on the wall, or ask any staff member nearby."` Department name: large, centred, high contrast. A `Call for Help` button that triggers a loud audio chime (single calm chime, not alarming). (2) **YELLOW** — warm amber ambient glow, Mennie speaks the department + navigation instructions from RAG if available, `"Let the front desk know you've checked in with Mennie."` Shows: department name + floor/navigation text + `Check In` button (marks session as patient-arrived in Supabase). (3) **GREEN** — soft green ambient, Mennie says the routing direction, navigation text, estimated wait time if available from queue. All three states show the non-diagnostic disclaimer at the bottom. `Start Over` button returns to landing for the next patient (kiosk resets after 90 seconds of inactivity via `InactivityReset` component).

---

### Step 72 | Owner: Dev | ID: MW-ACCESSIBILITY — Accessibility Mode

**Description:** Healthcare users include elderly patients, low-vision users, and non-native speakers. The accessibility mode triggered from the FAB must make the entire app usable for them.

**Claude Code Prompt:**
> Implement accessibility mode in `apps/mennie-web/`. Triggered from FAB `Get Help → Accessibility Mode` (Step 61). When activated: (1) Apply `ACCESSIBLE` theme (Step 67) — high contrast colours, minimum body text 18px, heading text 24px, (2) All Framer Motion animations disabled (set `AnimatePresence` exit/enter to `duration: 0`), (3) Mennie's voice slows down (`speechSynthesis.rate = 0.8`) and speaks every instruction out loud proactively (normally she only speaks on interaction), (4) All buttons gain minimum 56px touch target height, (5) Every interactive element gets a visible focus ring (2px blue, 4px offset), (6) Language selector appears — initially English; Hindi and Hinglish options available (Mennie's greeting text and instructions switch language — same i18n strings as HealthMate kiosk), (7) A `Large Print` toggle makes all text 1.4× bigger, (8) Accessibility state is saved to `localStorage` so it persists across page refreshes during the session. Add `aria-live="polite"` to Mennie's text output so screen readers announce her responses.

---

### Step 73 | Owner: Pratham | ID: MW-FACE-PRIVACY — Face Data Privacy Controls

**Description:** Face recognition in a healthcare app requires explicit consent and user control. Users must be able to see, update, and delete their face data at any time.

**Claude Code Prompt:**
> Create `apps/mennie-web/app/settings/face-data/page.tsx`. This page (accessible from FAB → Settings) shows: (1) **Face Recognition Status** — enabled / disabled toggle per user. If disabled: face recognition is skipped, Mennie goes directly to `onUnknown()` flow, (2) **Enrolled since** date (when the face was registered), (3) **Delete my face data** button — confirms via a dialog (`"This will remove your face data. Mennie won't recognise you automatically next time."`), calls `DELETE /auth/face/remove`, clears the local face model cache, (4) **Re-enrol** button — runs face capture again (3 frames, average embedding), updates stored embedding, (5) **Consent statement** (always visible, non-dismissable on this page): `"Your face data is stored as a mathematical description (embedding), not as an image. It is stored securely and used only to recognise you when you return. It is never shared with third parties."`, (6) Add this page link to the FAB `Settings` option. Also add a **first-time consent modal** that appears before face recognition runs for the first time for any new device — must be explicitly accepted before `getUserMedia` is called.

---

### Step 74 | Owner: Dev + Maanav + Pratham | ID: MW-E2E-SMOKE — Mennie Web Full Flow Smoke Test

**Description:** End-to-end verification that the complete Mennie experience works — from face recognition to doctor dashboard to patient intake result.

**Claude Code Prompt:**
> Add Playwright tests for `apps/mennie-web/` to the existing E2E suite (from Step 52). Add to `playwright.config.ts`: `mennie-web` at port 3200. Test suites: (1) **New visitor flow** (camera mocked — use Playwright's `addInitScript` to mock `getUserMedia` with a test video stream): navigate to `localhost:3200` → face recognition runs → `onUnknown()` fires → visitor flow starts → user selects "patient" → enters name → intake page loads → symptom text submitted → result screen shows urgency + department + disclaimer, (2) **Doctor face login** (face recognition mocked to return a test doctor JWT): landing → face recognised as doctor → greeting animation → redirect to `/doctor/dashboard` → queue card visible → patient list visible → analytics page loads all 5 charts, (3) **FAB manual login fallback**: navigate to landing → hover near bottom-right → FAB appears → click → login modal opens → enter test doctor credentials → dashboard loads, (4) **Accessibility mode**: FAB → Get Help → Accessibility Mode → verify `ACCESSIBLE` theme CSS vars applied → verify font-size ≥ 18px → verify button height ≥ 56px. Run with `pnpm --filter mennie-web e2e`.

---

## Execution Order — Mennie Webapp

```
Week 1:   Step 55 (scaffold) + Step 57 (face BE) — Dev + Maanav in parallel
Week 1–2: Step 56 (landing) + Step 58 (face FE) + Step 61 (FAB) — Dev + Pratham
Week 2:   Step 59 (role routing) + Step 60 (new visitor) + Step 66 (Mennie avatar/voice) — Dev + Pratham
Week 2–3: Step 62 (doctor dash) + Step 63 (graphs) + Step 64 (patient detail) — Dev
Week 3:   Step 65 (patient intake via Mennie) + Step 70 (manual login modal) — Dev
Week 3–4: Step 67 (adaptive theming) + Step 68 (micro-animations) + Step 71 (result screen) — Dev
Week 4:   Step 69 (API bridge) + Step 72 (accessibility) + Step 73 (face privacy) — Dev + Maanav
Week 5:   Step 74 (smoke tests) + integration testing — All
```

---

## Role Summary — Mennie Webapp

| Owner | Steps | Focus |
|-------|-------|-------|
| **Dev** | 55, 56, 59, 60, 61, 62, 63, 64, 65, 67, 68, 70, 71, 72, 74 | All UI, animations, dashboard, adaptive theme, FAB |
| **Pratham** | 57 (shared), 58, 66, 73 | Face recognition FE, Mennie avatar/voice/expressions, face privacy |
| **Maanav** | 57, 69, 74 (shared) | Face embedding API, API bridge, CORS updates |

---

## Status Summary

Steps 1–34 are **fully complete** as of 2026-06-05. The monorepo is live at `D:\Mennie\` with:
- HealthMate backend (FastAPI): real LLM connected, auth hardened, 100 eval cases, 7 datasets, RAG wired
- MediStaff API (Express/TypeScript): all services complete, 11+ tests passing
- MediStaff Web (Next.js 14): queue, visit detail, prescription composer complete — stub pages remain
- Kubernetes manifests: full kustomize dev/staging/prod overlays
- LoRA setup: scaffold done, blocked on pilot data (intentional)

**What remains** falls into three categories:
1. **Missing features** — stub pages and API gaps from PROJECT_STATUS.md Known Gaps
2. **Security hardening** — required before any staging deployment
3. **Verification gates** — must pass before hospital pilot

---

## Remaining Steps (35–54)

### IMMEDIATE — Blocks Production or Staging

---

**Step 35 | Owner: Maanav | ID: BE-SEC-01 — CORS Whitelist**

**Description:** `medistaff-api` currently has an open CORS config (`*`). Must be locked to specific origins before staging. HealthMate backend similarly needs review.

**Claude Code Prompt:**
> In `apps/medistaff-api/src/index.ts` (or wherever `cors()` is configured), replace the open wildcard CORS config with an allowlist driven by environment variable. Add `CORS_ALLOWED_ORIGINS` to `.env.example` (comma-separated list). In dev: default to `http://localhost:3100,http://localhost:3000`. In staging/prod: read from env. Apply the same pattern to `apps/healthmate-backend/app/main.py` — check the current FastAPI CORS middleware and ensure it is not `allow_origins=["*"]` for non-local environments. Add a startup assertion that rejects launch if `ENVIRONMENT != local` and `CORS_ALLOWED_ORIGINS` is not set.

---

**Step 36 | Owner: Maanav | ID: BE-AUTH-02 — Doctor PIN Setup Endpoint**

**Description:** `POST /auth/set-pin` is missing from `medistaff-api`. Without it, doctors cannot set their PIN, which blocks the `ESignatureService` flow in production. Hard blocker for prescription signing.

**Claude Code Prompt:**
> In `apps/medistaff-api/src/auth-service.ts`, add a `POST /auth/set-pin` endpoint. It must: (1) require a valid JWT (`requireRole(['DOCTOR'])`), (2) accept `{ currentPassword: string, newPin: string }` in the body, (3) validate `currentPassword` matches the user's stored password hash, (4) validate `newPin` is exactly 6 digits, (5) hash the PIN using HMAC with `PIN_HMAC_SECRET` — same mechanism as `ESignatureService.validatePin()`, (6) update `doctorPinHash` on the `User` record via Prisma, (7) log to `AuditService` with `action_type: PIN_SET`. Unit tests: success, wrong current password, invalid PIN format, non-doctor role rejection.

---

**Step 37 | Owner: Maanav | ID: BE-DB-01 — Prisma Generate + Migration Verification**

**Description:** Migration `20260605160000_renewal_fields` was written but `prisma generate` was never confirmed as run. All Prisma client usage depends on this being current. Must complete before any deploy.

**Claude Code Prompt:**
> In `packages/db/`, run `pnpm prisma generate` to regenerate the Prisma client from `schema.prisma` (includes `dueDate`, `lastDispensedDate`, `originalPrescriptionId` from the latest migration). Then run `pnpm prisma migrate deploy` against a real PostgreSQL instance (use `DATABASE_URL` from `.env`). After migration: run `pnpm db:seed` to populate test data. Execute the audit trigger test SQL from `packages/db/prisma/migrations/20260605134000_prevent_audit_log_mutation/` to confirm the UPDATE/DELETE block is active on `audit_logs`. Document the result in `docs/backend/db_verification_log.md`.

---

**Step 38 | Owner: Pratham | ID: BE-GIT-01 — Git Staging + Monorepo Commit**

**Description:** Old `backend/` and `web/` trees are marked deleted in git. The new monorepo layout is entirely untracked. Must be committed before team collaboration or CI setup.

**Claude Code Prompt:**
> In `D:\Mennie\`, stage and commit the full monorepo restructure. Steps: (1) `git status` to confirm current state, (2) `git add -u` for deleted paths, (3) `git add apps/ packages/ infra/ docs/ pnpm-workspace.yaml turbo.json package.json pnpm-lock.yaml` for the new layout, (4) commit with message `feat: restructure into pnpm Turborepo monorepo (Steps 1-34 complete)` with a body listing what's in each app, (5) verify with `git log --oneline -5`. If an existing remote main branch has history, create branch `feat/monorepo-phase1` and open a PR instead of pushing to main.

---

### CORE FEATURE COMPLETIONS — Stub Pages to Wire Up

---

**Step 39 | Owner: Dev + Maanav | ID: FE-HMS-05 — Patients List Page**

**Description:** `/patients` in `medistaff-web` is a stub. No `GET /patients` list endpoint exists in the API. Both must be built together.

**Claude Code Prompt:**
> **Part A — Backend (Maanav):** In `apps/medistaff-api/src/`, add `GET /patients` endpoint. Accept: `?search=` (searches `mrn`, `firstName`, `lastName`, `abhaId`), `?page=`, `?limit=` (default 20). Return `{ patients: Patient[], total: number, page: number }`. Require `DOCTOR` or `NURSE` role. Cache search results in Redis with 30s TTL keyed by query string. Add unit test for pagination and search filter.
>
> **Part B — Frontend (Dev):** In `apps/medistaff-web/app/patients/page.tsx`, replace the stub with a full list page: search input (300ms debounce, min 2 chars), results table with columns (MRN, Name, Age, Blood Group, Chronic Conditions badge, Last Visit date), pagination controls, loading skeleton, empty state. Clicking a row navigates to `/patients/[id]`. Use TanStack Query. Auth-gate.

---

**Step 40 | Owner: Dev | ID: FE-HMS-06 — Renewals List Page**

**Description:** `/renewals` in `medistaff-web` is a stub. The `GET /renewals` API is fully implemented but the frontend was never wired. Overdue renewals need visual priority treatment.

**Claude Code Prompt:**
> In `apps/medistaff-web/app/renewals/page.tsx`, replace the stub with a full renewals list. Fetch `GET /renewals` (returns `PrescriptionRenewal[]` with `daysUntilDue` per item). Table columns: Patient Name, Medicine, Due Date, Days Until Due, Status. Visual treatment: `daysUntilDue < 0` → red row + "OVERDUE" badge; `daysUntilDue <= 3` → amber highlight; else normal. Per-row actions: [Approve] → `POST /renewals/:id/approve`; [Reject] → modal with required reason field → `POST /renewals/:id/reject`. Optimistic update + refetch on action. Show renewal count badge in sidebar nav item (reuse TopBar notification pattern). TanStack Query. Auth-gate.

---

**Step 41 | Owner: Maanav + Dev | ID: BE-HMS-07 + FE-HMS-07 — Audit Log**

**Description:** `GET /audit-logs` endpoint is missing from `medistaff-api`. `/audit-log` in `medistaff-web` is a stub. Hospital compliance requires both.

**Claude Code Prompt:**
> **Part A — Backend (Maanav):** In `apps/medistaff-api/src/`, add `GET /audit-logs`. Require `ADMIN` role. Accept: `?actorId=`, `?entityType=`, `?actionType=`, `?from=` (ISO date), `?to=` (ISO date), `?page=`, `?limit=` (default 50, max 200). Query `audit_logs` via Prisma SELECT only — never UPDATE/DELETE. Return `{ logs: AuditLog[], total: number }`. Redact `beforeValue`/`afterValue` JSON for non-ADMIN actors. Unit test: role guard, pagination, date filter.
>
> **Part B — Frontend (Dev):** In `apps/medistaff-web/app/audit-log/page.tsx`, replace the stub: filters (date range, action type dropdown, entity type dropdown, actor search), table (Timestamp, Actor + role badge, Action, Entity Type, Entity ID), expandable row for `beforeValue`/`afterValue` diff (ADMIN only), CSV export button (client-side). Pagination.

---

**Step 42 | Owner: Maanav | ID: BE-HMS-08 — Visits List Endpoint**

**Description:** `GET /visits` list with filters is missing. The individual `GET /visits/:visitId` exists but doctors need to browse visits across patients, dates, or status.

**Claude Code Prompt:**
> In `apps/medistaff-api/src/`, add `GET /visits` list. Accept: `?patientId=`, `?doctorId=`, `?status=` (WAITING/IN_PROGRESS/COMPLETED/CANCELLED), `?from=` (ISO date), `?to=` (ISO date), `?page=`, `?limit=` (default 20). Return `{ visits: Visit[], total: number }` where each Visit includes linked `AiCaseSummary` `urgency`, `status`, and `recommendedDepartment` (not full summary text). Require `DOCTOR` or `NURSE` role. Add `?mine=true` shortcut filtering to `doctorId = req.user.id`. Unit test for filter combinations.

---

### SECURITY HARDENING

---

**Step 43 | Owner: Maanav | ID: BE-SEC-02 — Rate Limiting on Auth Routes**

**Description:** `/auth/login`, `/auth/refresh`, `/auth/set-pin` have no rate limiting. Brute-force attacks on a clinical system are a serious risk.

**Claude Code Prompt:**
> In `apps/medistaff-api/src/`, add rate limiting to `/auth/*` using `express-rate-limit` with a Redis store (`rate-limit-redis`). Config: `POST /auth/login` → 10 requests/15min per IP; `POST /auth/refresh` → 30 requests/15min per IP; `POST /auth/set-pin` → 5 requests/60min per IP. On breach: `429 Too Many Requests` with `Retry-After` header. Add `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX` to `.env.example` as optional overrides. Graceful degradation to in-memory if Redis unavailable (same fallback pattern as `QueueService`).

---

**Step 44 | Owner: Maanav | ID: BE-SEC-03 — WebSocket Auth Hardening**

**Description:** Socket.io connections are not cryptographically verified on all handshake paths. Must be hardened before staging.

**Claude Code Prompt:**
> In `apps/medistaff-api/src/` (Socket.io setup), add `io.use()` middleware: (1) extract JWT from `socket.handshake.auth.token` OR `socket.handshake.headers.authorization` (Bearer), (2) verify using the same RS256 public key as `requireRole()`, (3) invalid/expired → `next(new Error('Authentication error'))` triggering `connect_error` on client, (4) attach `socket.data.user = { id, role }`. Update `medistaff-web`'s Socket.io connect options to send `auth: { token: <jwt> }`. Test: client with expired token gets `connect_error` and receives no queue events.

---

**Step 45 | Owner: Pratham | ID: INFRA-SEC-01 — Secrets Rotation Procedure**

**Description:** All K8s Secret manifests use `REPLACE_ME_*` placeholders. No documented procedure exists for populating or rotating secrets. Required before staging.

**Claude Code Prompt:**
> Create `infra/k8s/SECRETS_MANAGEMENT.md` covering: (1) full list of all secrets per app (from `infra/k8s/` secret templates), (2) how to populate before first deploy via `kubectl create secret` or a secrets manager, (3) rotation for RS256 JWT keypair — `openssl` generation, Secret update, rolling restart, (4) rotation for database password, (5) rotation for `PIN_HMAC_SECRET` and `PRESCRIPTION_HMAC_SECRET` — note this invalidates all existing signed prescription PDFs (document the implication explicitly), (6) rotation for Twilio/Resend API keys. Add `scripts/generate-secrets-template.sh` outputting `kubectl create secret` commands with safe placeholder values for bootstrapping new environments.

---

### VERIFICATION GATES — Must Pass Before Pilot

---

**Step 46 | Owner: Pratham | ID: EVAL-RUN-01 — Run Eval Harness Against Live Ollama**

**Description:** The 100-case eval harness has never been run against live `qwen2.5:7b-instruct`. All 43 validation checklist items remain `REVIEW_REQUIRED`. Phase A exit gate cannot be cleared without actual results.

**Claude Code Prompt:**
> In `apps/healthmate-backend/`: (1) ensure Ollama is running with `qwen2.5:7b-instruct` pulled (`ollama pull qwen2.5:7b-instruct`), (2) set `ENVIRONMENT=local` and `LLM_PROVIDER=ollama` in `.env`, (3) run `python -m app.services.eval_harness` — executes all 100 cases and writes results to `data/eval_results/run_<timestamp>.json`, (4) Phase A exit gate = emergency escalation accuracy 100% AND forbidden advice accuracy 100%. If either fails: fix the relevant rule in `rules.py` and re-run until both pass, (5) save the final passing run as `data/eval_results/phase_a_gate_pass.json`, (6) update `step8_validation_checklist_v1.csv` CHK-001 through CHK-010 with actual PASS or FAIL status.

---

**Step 47 | Owner: Pratham | ID: EVAL-CHECKLIST-01 — Run All 43 Validation Checks**

**Description:** `step8_validation_checklist_v1.csv` has 43 checks all at `REVIEW_REQUIRED`. Must be executed and resolved before pilot.

**Claude Code Prompt:**
> Create `apps/healthmate-backend/app/services/validation_runner.py`. The script: (1) reads `data/step8_validation_checklist_v1.csv`, (2) implements each check against the referenced dataset CSV — e.g. CHK-001 (mandatory fields in step3): no nulls in required columns; CHK-019 (department vocabulary in step5): all `primary_department` values exist in `hospital_facts.DEPARTMENT_VOCABULARY`; CHK-028 (no clinical content in step6): no chunk content contains banned keywords from `rules.py`, (3) updates each row's `status` to PASS or FAIL with notes, (4) writes the updated CSV back, (5) prints a summary: total checks / passed / failed / REVIEW_REQUIRED remaining. Run the script and fix any FAILs at the source dataset level — re-run until all 43 are PASS.

---

**Step 48 | Owner: Pratham | ID: PILOT-DATA-01 — Fill PENDING_HOSPITAL_INPUT Knowledge Chunks**

**Description:** 52 of 85 knowledge pack chunks are `PENDING_HOSPITAL_INPUT` with placeholder content. The RAG system will return placeholder text to patients until real hospital data is filled in.

**Claude Code Prompt:**
> Create `docs/backend/hospital_data_collection_checklist.md` listing all 52 `PENDING_HOSPITAL_INPUT` rows from `data/step6_knowledge_pack_v1.csv` grouped by topic (floor_navigation, opd_timings, doctor_availability_info, etc.), with a data collection template per group showing exactly what fields are needed from the hospital. Once data is provided: (1) update each row's `content` in `step6_knowledge_pack_v1.csv`, (2) change `review_status` to `APPROVED`, (3) re-run the Qdrant knowledge pack loader to re-embed updated chunks. Add a second section for the 8 `HOSPITAL_SPECIFIC` rows in `step5_routing_ontology_v1.csv` — list what scheduling system data is needed per row.

---

**Step 49 | Owner: Pratham | ID: PILOT-DATA-02 — Clinical Safety Review Package**

**Description:** A qualified clinician must review the triage dataset, safety dataset, and eval results before the platform touches real patients. Non-negotiable pilot gate.

**Claude Code Prompt:**
> Create `docs/ai/clinical_safety_review_package.md` — a self-contained hand-off for the clinical reviewer. Include: (1) what HealthMate does and does NOT do (non-diagnostic, routing only, rule engine always wins over LLM), (2) table of all RED urgency cases in `step3_triage_dataset_v1.csv` marked `REVIEW_REQUIRED` (49 rows) with case_id, transcript, urgency, clinical_notes, (3) all `REVIEW_REQUIRED` rows from `step4_safety_dataset_v1.csv`, (4) Phase A gate eval results from Step 46, (5) full text of `extraction_v1.txt` and `clinician_summary_v1.txt`, (6) the 6 safety prohibitions in the extraction prompt, (7) sign-off section with date, reviewer name, and credentials.

---

### CI/CD PIPELINE

---

**Step 50 | Owner: Maanav | ID: INFRA-CI-01 — GitHub Actions CI Pipeline**

**Description:** No CI pipeline exists. Broken types, tests, or builds are undetected on any PR. Must be in place before staging.

**Claude Code Prompt:**
> Create `.github/workflows/ci.yml`. Triggers: push and PR to `main` and `feat/**`. Jobs in order: `typecheck` (`pnpm turbo typecheck`), `test` (`pnpm turbo test`), `build` (`pnpm turbo build`). Cache `node_modules` via `actions/cache` keyed on `pnpm-lock.yaml` hash. Separate Python job: `pip install -r requirements.txt`, `python -m py_compile` on all `.py` files, `python -m pytest apps/healthmate-backend/tests/ -x --tb=short`. Fail fast — typecheck failure skips subsequent jobs. Add CI status badge to root `README.md`.

---

**Step 51 | Owner: Maanav | ID: INFRA-CI-02 — Staging Deploy Workflow**

**Description:** Once CI is green, a one-click path to the staging K8s overlay is needed.

**Claude Code Prompt:**
> Create `.github/workflows/deploy-staging.yml`. Triggers: manual (`workflow_dispatch`) or on push to `main` after CI passes. Steps: (1) build Docker images for all 4 apps, tag with git SHA, push to `ghcr.io`, (2) patch image tags in `infra/k8s/overlays/staging/` via `kustomize edit set image`, (3) `kubectl apply -k infra/k8s/overlays/staging/`, (4) `kubectl rollout status deployment/healthmate-api -n healthmate` and same for medistaff-api, (5) smoke test: `curl https://<staging-host>/health` and `/hms/api/health` — fail workflow on non-200. Add `Dockerfile` for each app if not already present. Document required GitHub Actions secrets in `infra/k8s/SECRETS_MANAGEMENT.md`.

---

### E2E TESTING

---

**Step 52 | Owner: Dev | ID: FE-E2E-01 — Playwright E2E Test Suite**

**Description:** No end-to-end tests exist. The two critical happy-path flows need coverage before pilot.

**Claude Code Prompt:**
> Set up Playwright at monorepo root. Add `playwright.config.ts` targeting `healthmate-web` (port 3000) and `medistaff-web` (port 3100). Add `pnpm e2e` to root `package.json`. Suite 1 — Patient Intake Flow: navigate to kiosk → complete consent checkbox → enter symptom text → submit → verify result screen shows urgency badge + department name → verify disclaimer visible → verify no diagnosis or medicine name appears in result. Suite 2 — Clinician Full Flow (requires seeded test data): login to medistaff-web → navigate to Queue → verify patient appears → open visit detail → verify AI Summary Panel has "AI Suggested" labels on every AI field → click Approve → verify status changes and buttons disable → open prescription composer → add 2 medicines → verify drug interaction warning → fill PIN modal → verify success state.

---

### POST-PILOT — Do Not Start Before Pilot Data Is Clinically Reviewed

---

**Step 53 | Owner: Pratham | ID: ML-LORA-TRAIN — LoRA Fine-tuning (Post-Pilot)**

**Description:** Scaffold is complete at `apps/healthmate-backend/training/lora_finetune.py`. Gate: pilot complete + data clinically reviewed + base model eval shows improvement opportunity.

**Claude Code Prompt:**
> **GATE: Do not execute until pilot data is approved.** Once approved: (1) convert approved pilot sessions to training format — instruction = transcript, response = correct structured JSON (manually verified, not auto-generated), (2) run `python training/lora_finetune.py --smoke-test` to confirm GPU env, (3) run full training: `--base-model Qwen/Qwen2.5-7B-Instruct --data-path data/`, (4) after training, run `eval_harness.py` with adapter loaded and compare pass rate against Step 46 baseline, (5) only promote if emergency escalation stays 100% AND overall pass rate improves. Save decision in `training/adapters/healthmate_v1/PROMOTION_LOG.md`.

---

**Step 54 | Owner: Pratham + Maanav | ID: BE-MULTI-01 — Multi-Hospital Tenancy Design (Post-Pilot)**

**Description:** Current architecture assumes one hospital. Planning document only — no code until after pilot.

**Claude Code Prompt:**
> **GATE: Plan only — do not implement before pilot.** Create `docs/backend/multi_tenancy_design.md` covering: (1) current single-tenant assumptions in the codebase (`hospital_facts.py` hardcoded, single Prisma DB, single Supabase project), (2) recommended tenancy approach — schema-per-tenant vs row-level-security vs separate deployments — with trade-offs for healthcare compliance and data isolation, (3) impact on `hospital_config_service.py` (currently overwrites `hospital_facts.py` — needs tenant scoping), (4) impact on K8s overlays (namespace-per-tenant vs shared cluster), (5) migration path from single-tenant to multi-tenant without downtime.

---

## Execution Order

```
Week 1 (Now):    Step 35 (CORS) + Step 36 (set-pin) + Step 37 (prisma) + Step 38 (git) — parallel
Week 1–2:        Step 39 (patients list) + Step 40 (renewals) + Step 41 (audit log) — Dev + Maanav parallel
Week 2:          Step 42 (visits list) + Step 43 (rate limiting) + Step 44 (WebSocket auth) — Maanav
Week 2:          Step 46 (eval harness live run) + Step 47 (validation checklist) — Pratham
Week 2–3:        Step 45 (secrets docs) + Step 50 (CI pipeline) — Maanav
Week 3:          Step 48 (hospital data checklist) + Step 49 (clinical review package) — Pratham
Week 3:          Step 51 (staging deploy workflow) + Step 52 (Playwright E2E) — Maanav + Dev
Week 4:          Staging deploy → clinical review handoff → pilot gate decision
Post-pilot:      Step 53 (LoRA training) + Step 54 (multi-tenancy design)
```

---

## Exit Gates — Do Not Go to Pilot Until All Cleared

| Gate | Requirement | Owner |
|------|-------------|-------|
| Phase A | Eval harness: emergency escalation 100%, forbidden advice 100% (Step 46) | Pratham |
| Phase B1 | Consent flow E2E tested, PII masking confirmed active (Step 52) | Pratham + Maanav |
| DB verification | `prisma generate` run, migrations applied, audit trigger validated (Step 37) | Maanav |
| Security | CORS locked (35), rate limiting (43), WebSocket auth hardened (44) | Maanav |
| Data quality | All 43 validation checklist checks PASS (Step 47) | Pratham |
| Hospital data | 52 knowledge chunks + 8 routing rows filled with real data (Step 48) | Hospital + Pratham |
| Clinical safety | Qualified clinician signs off review package (Step 49) | External clinician + Pratham |

**Do not deploy to staging until Steps 35–47 are all complete.**
**Do not go to pilot until all 7 exit gates above are cleared.**

---

## Doctor Consultation Guide — What to Ask, What to Collect, What Is Legal

**Context:** You have access to Dr. Sanjay Pandey (Director of Urology, Kokilaben Dhirubhai Hospital) and potentially other specialists. This section tells you exactly what to ask each of them, what documents/sign-offs to collect, and what they can and cannot provide legally.

---

### What Doctors Can Legally Provide (No Legal Risk)

| What | Why It's Safe |
|------|---------------|
| Advisory review of **synthetic** triage scenarios | They are reviewing fictional cases you created — no patient data involved |
| Their clinical opinion on red flag patterns | General clinical knowledge, not patient-specific |
| OPD timings, floor numbers, department info | Publicly available hospital information |
| Their name + designation for sign-off | Professional credential, not patient data |
| Published clinical guidelines they reference | Already public domain |
| Advisory on what constitutes a routing emergency | Opinion/expertise, not a medical record |

**What doctors CANNOT provide (do not ask for this):**
- ❌ Any real patient records, case notes, or PHI (Personal Health Information)
- ❌ Prescription data from real patients
- ❌ Any data tied to a real patient identity
- ❌ Anything from their hospital's systems without written institutional approval

---

### What to Ask Dr. Sanjay Pandey (Urology Specialist)

Dr. Pandey can help with two things: (1) reviewing the urology cases in your triage dataset, and (2) the clinical safety sign-off for Step 49.

**Meeting 1 — Triage Dataset Review (Step 49)**

Send him the clinical safety review package (`docs/ai/clinical_safety_review_package.md` from Step 49) **before** the meeting. At the meeting, ask:

1. *"We have [X] urology-related cases in our triage dataset marked REVIEW_REQUIRED. Can you look at these and tell us if the urgency level (RED/YELLOW/GREEN) is clinically appropriate?"*
   — Give him the filtered list: cases where `expected_department = UROLOGY` and `clinical_notes = REVIEW_REQUIRED`

2. *"These are the red flags we currently escalate to RED urgency — are any of these wrong or missing for urology cases?"*
   — Show him the red flag taxonomy from `docs/ai/red_flag_taxonomy.md`

3. *"HealthMate never provides diagnosis, treatment, or dosage. It only routes the patient to the right department. Does this scope feel safe to you clinically?"*
   — This is the critical question. You need his comfort with the scope.

4. *"Would you be willing to sign the clinical sign-off section of this document with your name and designation?"*
   — The sign-off in Step 49's review package: name, designation, date, hospital.

**What to collect from him:**
- [ ] Written or email confirmation that urology RED urgency cases are appropriate
- [ ] Any red flags he says are missing for urology (e.g., haematuria + pain = emergency)
- [ ] Signed clinical safety review package (or email confirmation counts)
- [ ] His explicit sign-off that the non-diagnostic, routing-only scope is appropriate

---

### What to Ask Hospital Administration at Kokilaben (for Step 48)

Separate from Dr. Pandey — this is for filling the 52 `PENDING_HOSPITAL_INPUT` knowledge chunks. Ask the hospital admin / OPD manager:

**Hospital Data Collection Ask (use the checklist from Step 48):**

1. **Floor/Navigation data:**
   *"Can you provide the floor number and block for each of these departments?"*
   — List: Emergency, OPD, Urology, Cardiology, Radiology, Pharmacy, Lab, Billing, Insurance desk, General OPD

2. **OPD Timings:**
   *"What are the OPD hours for each department, Monday to Saturday?"*
   — They will have a printed schedule. Ask for a soft copy.

3. **Doctor Availability:**
   *"Which doctors are available for walk-in vs appointment-only? What are their OPD slots?"*
   — Phase 1 only uses this for navigation, not for booking. Clarify this to them.

4. **Emergency contact numbers:**
   *"What is the internal emergency number a front-desk staff member dials when a patient needs immediate escalation?"*
   — This goes into the hospital escalation config for the importer (Step 33).

5. **Appointment process:**
   *"How does a patient book an appointment — walk-in, call, app, or counter?"*
   — This fills the `appointment_process` knowledge chunks.

**What to collect:**
- [ ] Department floor map (a PDF or printed sheet is fine — you'll type it in)
- [ ] OPD timing sheet
- [ ] Doctor schedule (name, specialty, OPD days/times) — even a partial list is useful
- [ ] Emergency internal extension number
- [ ] Appointment booking process (1-2 sentences)

---

### What to Ask Other Specialist Doctors (for Different Departments)

For each specialist you can access, the ask is the same pattern as Dr. Pandey but filtered to their department cases. Priority departments to cover:

| Specialty | Red Flags to Validate | Cases to Review |
|-----------|----------------------|-----------------|
| **Cardiologist** | Chest pain + dyspnea, palpitations, syncope | All cases where `expected_department = CARDIOLOGY` |
| **Emergency Medicine (ER doc)** | ALL RED urgency cases across all departments | The 69 RED urgency rows in step3 triage dataset |
| **Gynaecologist** | Pregnancy-related routing, safe escalation paths | All `pregnancy_status = YES` cases |
| **Paediatrician** | Child-safe routing rules, no clinical advice boundary | All `age_group = child OR infant` cases |
| **General Physician** | YELLOW/GREEN routing accuracy for common complaints | A sample of 20 YELLOW cases |

The most important one after Dr. Pandey is an **Emergency Medicine doctor** — they can review all 69 RED urgency cases in one sitting and confirm the escalation is correct. This is the single highest-value clinical review you can get.

---

### How to Frame the Ask to Any Doctor (Script)

*"We're building a hospital AI triage tool. It does NOT diagnose or recommend treatment. It only listens to a patient's symptoms and tells them which department to go to — like a smart reception desk. We need a doctor to review our synthetic test cases and confirm the routing is clinically safe. It takes about 30–60 minutes. We'll give you a document in advance. Your name will appear on the sign-off page as a clinical advisor. There is no patient data involved — all cases are fictional scenarios we wrote."*

---

### Legal Formality (Optional but Recommended)

If the hospital or doctor asks for something formal before signing:

1. **Advisory Agreement (1 page):** States they are providing clinical advisory input, not medical advice to patients, and not sharing any patient data. Can be a simple email with these three points confirmed.
2. **IRB / Ethics Committee:** Only required if you intend to use real patient data during the pilot. For the synthetic dataset review, **no IRB is needed**. For the live pilot (collecting real sessions), you will need hospital ethics committee approval before going live.
3. **Dr. Pandey's institutional approval:** Since he is Director at Kokilaben, he may have authority to sign off on behalf of his department without extra paperwork. Ask him directly — most directors can do a personal advisory sign-off without institutional overhead for a non-clinical tool review.

---

### Summary — What You Walk Away With After These Conversations

| Document | From Whom | Used In |
|----------|-----------|---------|
| Clinical safety sign-off (signed or email) | Dr. Pandey + 1 ER doctor | Step 49 — Pilot gate |
| Corrected/confirmed RED urgency cases for urology | Dr. Pandey | Step 47 validation + step3 CSV fixes |
| Red flag additions/corrections | Any specialist | `red_flag_taxonomy.md` + `rules.py` |
| Hospital floor/OPD/navigation data | Hospital admin | Step 48 — fills 52 knowledge chunks |
| Ethics committee approval (for live pilot) | Hospital ethics board | Before pilot goes live with real patients |