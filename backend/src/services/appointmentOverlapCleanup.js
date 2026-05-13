import { Appointment } from "../models/Appointment.js";
import { appointmentsOverlap } from "../agents/utils/conflictDetection.js";

/**
 * Deletes extra appointments in each overlap cluster on each day, keeping the oldest (createdAt).
 * Scoped per userId so one doctor's overlaps don't affect another's records.
 * @returns {{ deletedCount: number }}
 */
export async function dedupeOverlappingAppointments() {
  const userIds = await Appointment.distinct("userId");
  let deletedCount = 0;

  for (const userId of userIds) {
    const dates = await Appointment.distinct("date", { userId });

    for (const date of dates) {
      const apps = await Appointment.find({ date, userId }).sort({ createdAt: 1 }).lean();
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
        const result = await Appointment.deleteMany({ _id: { $in: ids } });
        deletedCount += result.deletedCount ?? 0;
      }
    }
  }

  return { deletedCount };
}
