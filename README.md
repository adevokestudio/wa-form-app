# WA Form — WhatsApp Form Builder

A drag-and-drop form builder that turns answers into a pre-filled WhatsApp message, so a respondent fills out a web form and it opens WhatsApp ready to send — no backend chat integration required.

## Features

- Drag-and-drop builder with Basic and Advanced field types: Text, Multiple Choice, Checkbox, Dropdown, Number, Rating, Date, Email, Phone, Title/Heading, Image, Video, File Upload, Voice Note, E-Signature, Booking/Appointment Slot, Calculation, Live Quote Calculator, and Payment Link.
- Live WhatsApp message preview as you build.
- Conditional Logic (show/hide fields based on other answers) and Conditional WhatsApp Routing (send to a different number based on answers).
- Settings: General, SEO (real `<head>` metadata), Notifications, Team/routing.
- Google Sheet integration via an Apps Script Web App URL.
- QR code fallback for desktop respondents.

## Getting started

```bash
npm install
cp .env.local.example .env.local   # fill in your WhatsApp number
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tech stack

- Next.js 16 (App Router, Turbopack)
- React + TypeScript
- dnd-kit (drag-and-drop builder)
- Tailwind CSS

## Project structure

- `app/builder/[slug]/` — the form builder UI (drag-and-drop canvas, Add Questions panel, Settings, Share, Responses)
- `app/f/[slug]/` — the public-facing form a respondent fills out
- `app/api/` — form CRUD, submissions, and file uploads
- `lib/formSchema.ts` — field type definitions and form data model
- `lib/whatsapp.ts` — builds the pre-filled WhatsApp message from submitted answers
- `lib/formula.ts` — expression evaluator for Calculation / Live Quote fields

## Deploy

The easiest way to deploy is [Vercel](https://vercel.com/new), from the creators of Next.js. See the [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying) for other options.
