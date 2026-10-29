import { notFound } from "next/navigation";
import { getForm } from "@/lib/formsStore";
import { listSubmissionsForForm } from "@/lib/submissionsStore";

export default async function ResponsesPage({
  params,
}: PageProps<"/builder/[slug]/responses">) {
  const { slug } = await params;
  const form = await getForm(slug);

  if (!form) {
    notFound();
  }

  const submissions = await listSubmissionsForForm(slug);

  if (submissions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-400">
        No responses yet — once someone submits this form, they&apos;ll show up here.
      </div>
    );
  }

  // Union of every answer label across all submissions, in first-seen
  // order, so the table stays stable even if later submissions answer a
  // question earlier ones skipped (e.g. a Conditional Logic field).
  const columns: string[] = [];
  for (const submission of submissions) {
    for (const label of Object.keys(submission.answers)) {
      if (!columns.includes(label)) columns.push(label);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">
          {submissions.length} response{submissions.length === 1 ? "" : "s"}
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
              <th className="whitespace-nowrap px-4 py-2 font-medium">Submitted</th>
              {columns.map((col) => (
                <th key={col} className="whitespace-nowrap px-4 py-2 font-medium">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...submissions].reverse().map((submission, i) => (
              <tr key={i} className="border-b border-gray-50 last:border-0">
                <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-500">
                  {new Date(submission.submittedAt).toLocaleString()}
                </td>
                {columns.map((col) => (
                  <td key={col} className="whitespace-nowrap px-4 py-2 text-gray-700">
                    {submission.answers[col] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
