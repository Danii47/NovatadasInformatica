export function getTotalPoints ({ users, start }) {
  let totalPoints = 0

  for (let i = start; i < users.length; i++) {
    totalPoints += users[i].points
  }

  return totalPoints
}
