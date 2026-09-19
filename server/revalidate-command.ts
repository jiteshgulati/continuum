import 'dotenv/config';
import { Store } from './db';
import type { Knowledge, Notification } from './types';
const store = new Store();
const organisations = store.db
  .prepare("SELECT DISTINCT org_id FROM records WHERE kind='organisations'")
  .all() as { org_id: string }[];
let count = 0;
store.transaction(() => {
  for (const { org_id: orgId } of organisations) {
    const due = store
      .all<Knowledge>('knowledge', orgId)
      .filter(
        (c) => c.status === 'Verified' && c.reviewDueAt && Date.parse(c.reviewDueAt) < Date.now(),
      );
    for (const card of due) {
      const { versions, ...content } = card;
      const next = { ...content, status: 'Needs Verification' as const, version: card.version + 1 };
      store.put<Knowledge>('knowledge', {
        ...next,
        versions: [
          ...versions,
          {
            version: next.version,
            content: next,
            actor: 'Revalidation job',
            createdAt: new Date().toISOString(),
            reason: 'Scheduled review interval elapsed',
          },
        ],
      });
      store.audit(orgId, 'Revalidation job', card.id, 'Revalidation requested');
      count++;
    }
    if (due.length)
      store.put<Notification>('notifications', {
        ...store.base(orgId),
        message: `${due.length} knowledge cards are due for review.`,
        href: '/verification',
        read: false,
      });
  }
});
store.close();
console.log(`Requested revalidation for ${count} knowledge cards.`);
