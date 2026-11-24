import { notFound } from "next/navigation";
import { canAccessForm, requireUser } from "@/lib/auth";
import { getForm } from "@/lib/formsStore";
import { getUserById } from "@/lib/usersStore";
import TopNav from "./TopNav";

// Every page here depends on who's logged in and which form they own —
// never pre-build it as a static page shared by every visitor.
export const dynamic = "force-dynamic";

export default async function BuilderLayout({
  params,
  children,
}: LayoutProps<"/builder/[slug]">) {
  const { slug } = await params;
  const user = await requireUser(`/builder/${slug}`);
  const form = await getForm(slug);

  // Same response (404) whether the form doesn't exist or belongs to
  // someone else — a client shouldn't be able to tell the two apart.
  if (!form || !canAccessForm(user, form)) {
    notFound();
  }

  // The Catalogue/Cart tabs only show up for a form whose owning account
  // has the (admin-granted) premium feature switched on — look that up by
  // the form's actual owner, not the signed-in user, so an admin viewing
  // a specific client's form (?client=<id>) sees that client's setting.
  const owner = form.ownerId ? await getUserById(form.ownerId) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav slug={form.slug} formName={form.name} catalogEnabled={owner?.catalogEnabled ?? false} />
      <div className="mx-auto max-w-5xl px-4 py-6">{children}</div>
    </div>
  );
}
