export const PROFILE_UPDATED_EVENT = "profile-updated";

export function dispatchProfileUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
  }
}
