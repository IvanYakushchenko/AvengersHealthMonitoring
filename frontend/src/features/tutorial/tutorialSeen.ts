// Code was assisted with Claude.
// Remembers, in this browser only, that a crew member has finished or skipped the tutorial.
// Stored per username. If the browser blocks storage, the tutorial simply shows again.
const keyFor = (username: string) => `ahm-tutorial-seen:${username.toLowerCase()}`

// True if this user has already finished or skipped the tutorial in this browser.
export function hasSeenTutorial(username: string): boolean {
  try {
    return window.localStorage.getItem(keyFor(username)) === '1'
  } catch {
    return false
  }
}

// Remember that this user has finished or skipped the tutorial in this browser.
export function markTutorialSeen(username: string): void {
  try {
    window.localStorage.setItem(keyFor(username), '1')
  } catch {
    // Storage is blocked: nothing to remember.
  }
}
