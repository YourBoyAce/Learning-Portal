export const INBOX_UPDATED_EVENT = "inbox-updated";

export function dispatchInboxUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(INBOX_UPDATED_EVENT));
  }
}
