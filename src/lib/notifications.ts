import { getEvents } from "./activity";
import type { ActivityEvent } from "./activity";
import { listAccounts } from "./auth";
import { getProgress } from "./progress";
import { getItem } from "./store";

export interface AppNotification {
  id: string;
  text: string;
  at: string;
}

interface RedemptionRecord {
  rewardId: string;
  at: string;
}

const MAX_ITEMS = 20;

const EVENT_TEXT: Record<ActivityEvent["type"], string> = {
  login: "Account mein login hua",
  role_change: "Aapka role badla gaya",
  password_reset: "Aapka password reset hua",
  account_deleted: "Aapka account delete hua",
  account_updated: "Aapka account update hua",
  account_created: "Aapka account bana",
  approval: "Aapka account approve hua",
};

/**
 * Notifications for one account, derived read-only from the activity log,
 * course progress and reward redemptions. Newest first. Never throws:
 * a source that fails or is missing is simply skipped.
 */
export function getNotifications(accountId: string): AppNotification[] {
  const out: AppNotification[] = [];
  try {
    const account = listAccounts().find((a) => a.id === accountId);
    if (!account) return [];
    const email = account.email.toLowerCase();

    try {
      for (const e of getEvents()) {
        const actor = String(e.actor ?? "").toLowerCase();
        const target = String(e.target ?? "").toLowerCase();
        if (actor !== email && target !== email) continue;
        const base = EVENT_TEXT[e.type] ?? "Account mein activity hui";
        out.push({
          id: `event-${e.id}`,
          text: e.detail ? `${base} (${e.detail})` : base,
          at: e.at,
        });
      }
    } catch {
      /* activity log unavailable */
    }

    try {
      const activity = getProgress(accountId).activity;
      activity.forEach((a, i) => {
        if (a.kind === "chapter") {
          out.push({
            id: `chapter-${i}-${a.at}`,
            text: `Chapter poora hua: ${a.chapterId ?? ""}`.trim(),
            at: a.at,
          });
        }
      });
    } catch {
      /* progress unavailable */
    }

    try {
      const redeems = getItem<RedemptionRecord[]>("redemptions." + accountId, []);
      if (Array.isArray(redeems)) {
        redeems.forEach((r, i) => {
          out.push({ id: `redeem-${i}-${r.at}`, text: `Reward redeem kiya: ${r.rewardId}`, at: r.at });
        });
      }
    } catch {
      /* rewards unavailable */
    }

    out.sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0));
    return out.slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}
