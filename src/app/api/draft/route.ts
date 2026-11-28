import { withAccount } from "@/lib/auth-server";
import { DraftConflict, DraftInputError, organizeWebDraft, readWebDraft, saveWebDraft } from "@/lib/web-draft";
import type { WebDraft } from "@/lib/web-draft-model";
import { currentAccount } from "@/lib/account-context";

export const maxDuration = 300;

export const GET = withAccount(async () => {
  try {
    return Response.json({ draft: (await readWebDraft())?.draft ?? null });
  } catch {
    return Response.json({ error: "The cloud draft could not be loaded. Try again." }, { status: 503 });
  }
});

async function change(request: Request, action: (body: Record<string, unknown>) => Promise<WebDraft>, error: string) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "A valid draft is required." }, { status: 400 });
    }
    if (body.account !== currentAccount().userId) {
      return Response.json({ error: "Your account changed. Reopen the journal before saving." }, { status: 403 });
    }
    const draft = await action(body);
    return Response.json({ draft }, { status: draft.status === "organizing" ? 202 : 200 });
  } catch (cause) {
    if (cause instanceof DraftConflict) {
      const current = await readWebDraft().catch(() => undefined);
      if (current !== undefined) return Response.json({ draft: current?.draft ?? null }, { status: 409 });
    }
    if (cause instanceof DraftInputError) return Response.json({ error: cause.message }, { status: 400 });
    return Response.json({ error }, { status: 503 });
  }
}

export const PUT = withAccount(request => change(request, saveWebDraft, "The draft could not be saved to the cloud."));
export const POST = withAccount(request => change(request, body => organizeWebDraft(body.revision),
  "Your draft is saved to the cloud. August couldn’t organize it yet."));
