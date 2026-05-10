import { Appointment } from "../models/Appointment.js";
import { appointmentsOverlap } from "../agents/utils/conflictDetection.js";

/**
 * Deletes extra appointments in each overlap cluster on each day, keeping the oldest (createdAt).
 * @returns {{ deletedCount: number }}
 */
export async function dedupeOverlappingAppointments() {
  const dates = await Appointment.distinct("date");
  let deletedCount = 0;

  for (const date of dates) {
    const apps = await Appointment.find({ date }).sort({ createdAt: 1 }).lean();
    if (apps.length < 2) continue;

    const n = apps.length;
    const adj = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (appointmentsOverlap(apps[i], apps[j])) {
          adj[i].push(j);
          adj[j].push(i);
        }
      }
    }

    const visited = new Array(n).fill(false);
    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;
      const stack = [i];
      visited[i] = true;
      const indices = [];
      while (stack.length) {
        const u = stack.pop();
        indices.push(u);
        for (const v of adj[u]) {
          if (!visited[v]) {
            visited[v] = true;
            stack.push(v);
          }
        }
      }
      if (indices.length <= 1) continue;

      const cluster = indices.map((idx) => apps[idx]);
      cluster.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const toRemove = cluster.slice(1);
      const ids = toRemove.map((doc) => doc._id);
      const res = await Appointment.deleteMany({ _id: { $in: ids } });
      deletedCount += res.deletedCount ?? 0;
    }
  }

  return { deletedCount };
}
