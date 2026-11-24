import Link from "next/link";

const FEATURES: { title: string; description: string }[] = [
  {
    title: "Drag-and-drop builder",
    description:
      "Text, choice, checkbox, dropdown, date, image, video, file upload, voice note, e-signature, bookings, calculations and payment links — build any form without writing code.",
  },
  {
    title: "Straight to WhatsApp",
    description:
      "No backend chat integration to set up. A respondent submits the form and it opens WhatsApp with their answers already filled in, ready to send.",
  },
  {
    title: "Conditional logic & routing",
    description:
      "Show or hide questions based on earlier answers, and route a submission to a different WhatsApp number depending on how it's answered.",
  },
  {
    title: "Built for agencies",
    description:
      "Every client gets their own secure login, their own forms, and their own WhatsApp number — all managed from one place.",
  },
];

const STEPS: { title: string; description: string }[] = [
  {
    title: "Build",
    description: "Drag fields onto the canvas and preview the WhatsApp message as you go.",
  },
  {
    title: "Share",
    description: "Publish the form's link anywhere — social media, a website, a QR code.",
  },
  {
    title: "Submit",
    description: "A visitor fills it in and taps submit — WhatsApp opens with their answers pre-filled.",
  },
  {
    title: "Respond",
    description: "The message lands straight in your (or your client's) WhatsApp, ready to reply to.",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-gray-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-600 text-sm text-white">
              W
            </span>
            WA Form
          </div>
          <Link
            href="/login"
            className="rounded-md border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:border-gray-400"
          >
            Log in
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Forms that land straight in WhatsApp
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-gray-500">
          Build booking, enquiry and feedback forms in minutes — no backend, no chat integration. Every answer
          arrives as a ready-to-send WhatsApp message.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/login"
            className="rounded-md bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700"
          >
            Log in to your dashboard
          </Link>
        </div>
      </section>

      <section className="border-y border-gray-100 bg-gray-50 py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-gray-400">How it works</h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-4">
            {STEPS.map((step, i) => (
              <div key={step.title}>
                <div className="mb-2 text-sm font-bold text-green-600">{String(i + 1).padStart(2, "0")}</div>
                <h3 className="font-semibold text-gray-900">{step.title}</h3>
                <p className="mt-1 text-sm text-gray-500">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-center text-2xl font-semibold text-gray-900">Everything you need to collect answers</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-lg border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900">{feature.title}</h3>
              <p className="mt-1.5 text-sm text-gray-500">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-gray-100 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-6 text-center text-sm text-gray-400">
          <p>WA Form — a client portal for WhatsApp-powered forms.</p>
          <Link href="/login" className="font-medium text-gray-600 hover:text-green-700">
            Client log in
          </Link>
        </div>
      </footer>
    </main>
  );
}
