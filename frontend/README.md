# CrackDetect AI — Frontend

A Next.js 16 application for structural crack detection powered by YOLOv11 trained on the SDNET dataset.

## Stack
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4 with Material Design 3 color palette
- **Fonts:** Inter + JetBrains Mono + Material Symbols Outlined

## Pages
| Route | Description |
|---|---|
| `/` | System Dashboard — KPI cards, trend chart, recent inspections |
| `/inspection` | New Inspection — drag-and-drop upload + analysis params → calls FastAPI |
| `/results` | Detection Results — image viewer with bounding box canvas overlay |
| `/analysis` | Crack Analysis (coming soon) |
| `/analytics` | Analytics (coming soon) |
| `/reports` | Reports (coming soon) |
| `/settings` | Settings (coming soon) |

## Development Setup

### Prerequisites
- Node.js 18+
- FastAPI backend running on `http://localhost:8000` (see `/backend` folder)

### Install & Run

```bash
npm install
npm run dev
```

App will be available at `http://localhost:3000`

### Environment Variables

Copy `.env.local.example` to `.env.local` and update:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

For Vercel deployment, add `NEXT_PUBLIC_API_URL` pointing to your deployed FastAPI backend (e.g., Railway, Render, or a VPS).

## Deployment (Vercel)

1. Push this frontend folder to GitHub.
2. Import the repo in Vercel — select `frontend` as root directory.
3. Add environment variable `NEXT_PUBLIC_API_URL` in Vercel project settings.
4. Deploy!
