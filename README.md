# Continuum

**People move on. Knowledge shouldn’t.**

A full-stack institutional memory application built from the supplied Continuum hackathon specification. Experts capture operational knowledge through interviews and evidence. Human reviewers verify it. Teammates retrieve the resulting guidance with citations, contributor identity, evidence, and version history.

## Run locally

Requires **Node.js 24 or newer** and npm. SQLite is provided by Node itself; no database server is needed.

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Open **http://127.0.0.1:5173**. The API runs on port 3001. SQLite and original uploads persist under `data/` and survive server restarts.

Click **Open example workspace**, or sign in with one of these local example accounts:

| Role     | Email                  | Password         |
| -------- | ---------------------- | ---------------- |
| Admin    | `alex@continuum.demo`  | `Continuum2026!` |
| Reviewer | `priya@continuum.demo` | `Continuum2026!` |
| Employee | `rahul@continuum.demo` | `Continuum2026!` |

These are deliberately public example credentials for a synthetic workspace. Automatic example seeding and the example-login button are disabled when `NODE_ENV=production`, unless `ENABLE_DEMO=true`. Use a **fresh database** for a public deployment; changing the environment does not remove previously seeded accounts. Sign-up creates a separate, empty organisation with its own administrator and expert profile.

## Connect your OpenAI-compatible API

Edit `.env` on the server:

```dotenv
AI_PROVIDER=compatible
AI_BASE_URL=https://your-provider.example/v1
AI_API_KEY=your-secret-key
AI_MODEL=your-model-id
```

The adapter calls `POST {AI_BASE_URL}/chat/completions` with bearer authentication and `response_format: {"type":"json_object"}`. Choose a provider and model supporting that interface. Restart the API after changing environment variables. Keys are never sent to the browser or included in API responses.

When configuration is missing, the app shows a setup message. It **does not substitute canned model responses**. Profile management, notes, uploads, manual knowledge contributions, verification, search, conflicts with the explicit PaymentWorker rule, health reporting, and audit history still work. Interviews save submitted answers even when an AI call fails; the next-question action retries without submitting the answer again.

The AI provider supports six tasks: contextual interview questions, structured knowledge extraction, document analysis, grounded answers, contradiction detection, and source-linked handover reports. Responses are validated with Zod. Unknown source IDs cause the request to fail without accepting the model’s output.

### Amazon Bedrock

The alternative provider uses the AWS SDK `Converse` API. No frontend or schema change is required:

```dotenv
AI_PROVIDER=bedrock
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=your-enabled-model-or-inference-profile-id
```

Use the standard AWS credential chain or a workload IAM role with access to the selected model. Bedrock configuration and a real account invocation are still required before claiming a working Bedrock deployment.

## What is implemented

- Responsive dark interface with overview, people, profiles, knowledge library, Ask Continuum, verification, conflicts, reports, and settings.
- Sign-up, password hashing with salted scrypt, HttpOnly sessions, persistent sign-in, logout, password changes, and server-side Admin/Reviewer/Employee permissions.
- Organisation scoping for all records and private document retrieval. Members can be linked to existing expert profiles.
- Editable expert profiles, departure status, backup counts, knowledge areas, and explicit knowledge-risk rules.
- Persistent interview sessions, pause/resume, transcript downloads, saved answers, contextual AI questions, discovery panels, notes, and evidence uploads.
- PDF, DOCX, TXT, and Markdown text extraction. Maximum original size: 10 MB. Scanned PDFs, encrypted documents, and OCR are not supported.
- Structured knowledge drafts, immutable version snapshots, original source preservation, clarification questions, and confidence signals separated from verification.
- Verify, edit and verify, reject, clarify, dispute, and archive decisions. Optimistic version checks prevent stale reviewer tabs from overwriting a newer decision.
- Contributor clarification responses with additional evidence and a return to the verification queue.
- Search, status/area/type/contributor filters, sorting, and grid/list views.
- Keyword retrieval followed by model-generated answers restricted to retrieved, verified cards. Rejected, archived, outdated, disputed, and unresolved-conflict knowledge is excluded from definitive answers. Sources and related unverified knowledge are visible separately.
- AI contradiction checks and an explicitly identified deterministic PaymentWorker restart rule. Keep, replace, conditional merge, and clarification decisions are recorded. Clarification keeps a conflict open.
- Live database-derived metrics, source activity charts, verified coverage, dependency risk reports, text export, AI handover reports, and revalidation.
- In-app notifications and audit events.
- Local private file storage and an optional S3 implementation. Original file downloads pass through authenticated organisation checks.

## Three-minute walkthrough

1. Sign in as Alex. On Overview, open Rahul Sharma’s high-risk Payments entry.
2. Begin a knowledge handover in Payments. Generate an opening question, then describe the 502 incident and Redis connection exhaustion.
3. Add `examples/payment-incident.md` as evidence, or paste a source note. Analyse it if desired.
4. Generate knowledge drafts. They are saved as **Needs Verification**.
5. Open Verification, read a draft’s evidence, and verify or edit and verify it.
6. Update Rahul to **Departed**. His cards and original evidence remain available.
7. Ask “Payment API is returning 502. What should I check?” Follow a citation to its card and evidence.
8. Open the existing PaymentWorker conflict. Compare the manual restart runbook against the automated pipeline guidance and record a human decision. Alternatively contribute `examples/deployment-update.md` and run a conflict check.
9. Inspect Reports and the audit activity in Settings.

Steps involving generated questions, extraction, document analysis, grounded answers, and AI reports require a configured provider. The only deterministic model replacement is a test fixture inside `tests/`; application runtime never uses it.

## Commands

| Command              | Purpose                                                                      |
| -------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`        | Run the API and Vite development server                                      |
| `npm run build`      | Type-check all source and build the frontend                                 |
| `npm start`          | Serve the built frontend and API from port 3001                              |
| `npm test`           | Run integration and storage tests                                            |
| `npm run seed`       | Add the example workspace if it does not exist; does not reset existing data |
| `npm run revalidate` | Move overdue verified knowledge into the review queue                        |
| `npm run format`     | Format application and test source                                           |

## Project structure

```text
src/
  main.tsx              Login, protected application shell and routes
  api.ts                Typed client and shared presentation helpers
  context.tsx           Workspace data, refresh, and action state
  ui.tsx                Shared accessible interface components
  pages/                Dashboard, people, interviews, knowledge, Ask, management
  styles.css            Responsive design system
server/
  app.ts                Validated API, permissions, workflows and error handling
  ai.ts                 Compatible API and Bedrock provider implementations
  auth.ts               Passwords, users and revocable sessions
  db.ts                 SQLite persistence and transactions
  storage.ts            Private filesystem and S3 file adapters
  types.ts              Domain types
  seed.ts               Synthetic example workspace
tests/
  workflow.test.ts      Auth, tenancy, capture, review, retrieval, conflict and upload checks
examples/               Sample incident and deployment evidence
```

## Production and deployment

Build with `npm run build`, then run `npm start` behind an HTTPS reverse proxy. Set `NODE_ENV=production`, `APP_ORIGIN` to the exact public origin, `COOKIE_SECURE=true`, and `HOST=0.0.0.0` inside your container or private service network. The API and frontend are served from one origin. Keep credentials in the hosting platform’s secret manager.

A `Dockerfile` and `compose.yaml` are supplied. Docker is not installed in the build environment, so container execution has not been verified here.

```powershell
# After creating and configuring .env:
docker compose up --build -d
# Local production-style preview: http://127.0.0.1:3001
```

For local HTTP container testing use `APP_ORIGIN=http://127.0.0.1:3001` and `COOKIE_SECURE=false`. The compose port binds only to loopback. Put the service behind a configured HTTPS proxy before making it public.

The SQLite database needs a **persistent local volume**. This MVP is intentionally a **single application instance**. Do not deploy it on ephemeral Lambda storage or horizontally replicate it as-is. An AWS EC2 host with an EBS volume can run this container; upload storage can use private S3 and AI can use Bedrock. Cognito, DynamoDB migration, API Gateway/Lambda infrastructure, Amplify hosting, and EventBridge scheduling are not provisioned by this repository. Deploying those services requires account access and an explicit infrastructure migration.

### Private S3 files

```dotenv
FILE_STORAGE=s3
S3_BUCKET=your-private-bucket
AWS_REGION=us-east-1
```

Give the server IAM role `s3:PutObject` and `s3:GetObject` for `arn:aws:s3:::YOUR_BUCKET/continuum/*`. Keep public access blocked. The adapter encrypts uploads with S3-managed encryption and serves file content through the authenticated application route; the browser never receives an object storage key. A real bucket and credentials are required. Switching storage modes does not migrate existing originals.

### Revalidation

`npm run revalidate` processes every organisation’s overdue verified cards, preserves the previous version, adds an audit event, and creates a notification. It can be invoked by a host scheduler; an AWS deployment can trigger the command using its approved scheduling mechanism. Reports also provides a manual action restricted to Admin/Reviewer users.

## Verification and remaining setup

Automated integration tests use an explicitly labelled deterministic AI fixture. They verify workflow logic without an external account, including model failure recovery and rejection of fabricated sources. Real provider requests, Bedrock, S3, and a public deployment cannot be verified until credentials and a target environment are configured.

Email delivery, password recovery by email, invitation emails, enterprise SSO, semantic embeddings, OCR, voice, billing, and external knowledge sync are not implemented. Forgot password explains the local account limitation instead of pretending to send a recovery email. Risk backup counts are administrator-maintained metadata, not an HR integration.

The supplied PDF was readable and used as the build reference. Windows denied access to the supplied OneDrive Word document, including an elevated read attempt; its contents could not be incorporated.
