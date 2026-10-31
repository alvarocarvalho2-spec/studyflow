export type SmartPlanTopic = {
  id: string;
  name: string;
  subjectName: string;
  difficulty: number;
};

export type SmartPlanGoal = {
  id: string;
  kind: "exam" | "mastery" | "custom";
  title: string;
  targetDate: string | null;
  topicId: string | null;
};

export type SmartPlanCard = {
  topicId: string | null;
  nextReviewAt: string;
  lastReviewedAt: string | null;
};

export type SmartPlanStudySession = {
  topicId: string | null;
  finishedAt: string;
};

export type SmartPlanPendingTask = {
  topicId: string;
  taskDate: string;
};

export type SmartPlanInput = {
  today: string;
  now: string;
  availableDays: number[];
  dailyMinutes: number;
  topics: SmartPlanTopic[];
  goals: SmartPlanGoal[];
  cards: SmartPlanCard[];
  sessions: SmartPlanStudySession[];
  pendingTasks: SmartPlanPendingTask[];
};

export type GeneratedTask = {
  topic_id: string;
  goal_id: string | null;
  task_date: string;
  position: number;
  task_type: "study" | "review" | "practice";
  title: string;
  duration_minutes: 15 | 25 | 45;
  priority_score: number;
  recommendation_reason: string;
};

export type GeneratedPlan = {
  startDate: string;
  endDate: string;
  tasks: GeneratedTask[];
  summary: {
    algorithmVersion: "v1";
    totalTasks: number;
    totalMinutes: number;
    scheduledDays: number;
    goalCount: number;
  };
};

function addDays(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function dayDistance(from: string, to: string) {
  const fromDate = Date.parse(`${from.slice(0, 10)}T00:00:00.000Z`);
  const toDate = Date.parse(`${to.slice(0, 10)}T00:00:00.000Z`);
  return Math.round((toDate - fromDate) / 86_400_000);
}

function isoWeekday(date: string) {
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

function recentDate(current: string | null, candidate: string | null) {
  if (!candidate) return current;
  if (!current || Date.parse(candidate) > Date.parse(current)) return candidate;
  return current;
}

function pickDurationBlocks(minutes: number) {
  const blocks: Array<15 | 25 | 45> = [];
  let remaining = Math.max(0, Math.min(720, Math.floor(minutes)));

  while (remaining >= 15 && blocks.length < 48) {
    const duration = remaining >= 45 ? 45 : remaining >= 25 ? 25 : 15;
    blocks.push(duration);
    remaining -= duration;
  }

  return blocks;
}

function goalForTopic(goals: SmartPlanGoal[], topicId: string) {
  return goals
    .filter((goal) => goal.topicId === topicId || goal.topicId === null)
    .sort((left, right) => {
      const leftSpecific = Number(left.topicId === topicId);
      const rightSpecific = Number(right.topicId === topicId);
      if (leftSpecific !== rightSpecific) return rightSpecific - leftSpecific;
      const leftDate = left.targetDate ?? "9999-12-31";
      const rightDate = right.targetDate ?? "9999-12-31";
      if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
      return left.id.localeCompare(right.id);
    })[0] ?? null;
}

export function getDateInTimezone(date: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: timezone,
    }).formatToParts(date);
    const values = new Map(parts.map((part) => [part.type, part.value]));
    return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function generateSmartPlan(input: SmartPlanInput): GeneratedPlan {
  const startDate = input.today;
  const endDate = addDays(startDate, 6);
  const available = new Set(input.availableDays);
  const scheduleDates = Array.from({ length: 7 }, (_, index) => addDays(startDate, index))
    .filter((date) => available.has(isoWeekday(date)));
  const blocks = pickDurationBlocks(input.dailyMinutes);
  const dueByTopic = new Map<string, { count: number; oldestDate: string }>();
  const lastActivityByTopic = new Map<string, string>();
  const pendingByTopic = new Map<string, number>();

  for (const card of input.cards) {
    if (card.topicId && Date.parse(card.nextReviewAt) <= Date.parse(input.now)) {
      const due = dueByTopic.get(card.topicId);
      const dueDate = card.nextReviewAt.slice(0, 10);
      dueByTopic.set(card.topicId, {
        count: (due?.count ?? 0) + 1,
        oldestDate: !due || dueDate < due.oldestDate ? dueDate : due.oldestDate,
      });
    }
    if (card.topicId && card.lastReviewedAt) {
      lastActivityByTopic.set(
        card.topicId,
        recentDate(lastActivityByTopic.get(card.topicId) ?? null, card.lastReviewedAt)!,
      );
    }
  }

  for (const session of input.sessions) {
    if (session.topicId) {
      lastActivityByTopic.set(
        session.topicId,
        recentDate(lastActivityByTopic.get(session.topicId) ?? null, session.finishedAt)!,
      );
    }
  }

  for (const task of input.pendingTasks) {
    if (task.taskDate >= input.today) {
      pendingByTopic.set(task.topicId, (pendingByTopic.get(task.topicId) ?? 0) + 1);
    }
  }

  const topics = [...input.topics].sort((left, right) => left.id.localeCompare(right.id));
  const tasks: GeneratedTask[] = [];
  const countsByTopic = new Map<string, number>();

  for (const taskDate of scheduleDates) {
    let position = 0;

    for (const duration of blocks) {
      if (topics.length === 0) break;

      const ranked = topics.map((topic) => {
        const due = dueByTopic.get(topic.id);
        const goal = goalForTopic(input.goals, topic.id);
        const daysSinceActivity = lastActivityByTopic.has(topic.id)
          ? Math.max(0, dayDistance(lastActivityByTopic.get(topic.id)!, `${input.now.slice(0, 10)}`))
          : 14;
        const daysUntilGoal = goal?.targetDate ? dayDistance(input.today, goal.targetDate) : null;
        const overdueDays = due?.oldestDate ? Math.max(0, dayDistance(due.oldestDate, input.today)) : 0;
        const difficultyPoints = topic.difficulty * 7;
        const overduePoints = due ? Math.min(28, due.count * 4) + Math.min(22, overdueDays * 2) : 0;
        const inactivityPoints = Math.min(28, daysSinceActivity * 2);
        const goalPoints = !goal
          ? 0
          : goal.kind === "exam"
            ? daysUntilGoal === null
              ? 7
              : daysUntilGoal < 0
                ? 30
                : daysUntilGoal <= 3
                  ? 30
                  : daysUntilGoal <= 7
                    ? 24
                    : daysUntilGoal <= 14
                      ? 18
                      : daysUntilGoal <= 30
                        ? 12
                        : daysUntilGoal <= 60
                          ? 6
                          : 0
            : goal.kind === "mastery"
              ? 12
              : 6;
        const pendingPoints = Math.min(24, (pendingByTopic.get(topic.id) ?? 0) * 8);
        const spreadPenalty = (countsByTopic.get(topic.id) ?? 0) * 8;
        const rawScore = 24 + difficultyPoints + overduePoints + inactivityPoints + goalPoints + pendingPoints - spreadPenalty;
        const score = Math.max(0, Math.round(Math.min(100, rawScore / 1.85) * 100) / 100);

        return { topic, due, goal, daysUntilGoal, daysSinceActivity, overdueDays, score };
      }).sort((left, right) => right.score - left.score || left.topic.id.localeCompare(right.topic.id));

      const selected = ranked[0];
      const dueCount = selected.due?.count ?? 0;
      const taskType = dueCount > 0
        ? "review"
        : selected.goal?.kind === "exam" && selected.daysUntilGoal !== null && selected.daysUntilGoal <= 45
          ? "practice"
          : "study";
      const reasonParts: string[] = [];

      if (dueCount > 0) reasonParts.push(`${dueCount} ${dueCount === 1 ? "flashcard vencido" : "flashcards vencidos"}`);
      if (selected.topic.difficulty >= 4) reasonParts.push(`dificuldade percebida ${selected.topic.difficulty}/5`);
      if (selected.goal?.kind === "exam") {
        reasonParts.push(selected.daysUntilGoal === null
          ? `meta de prova “${selected.goal.title}”`
          : selected.daysUntilGoal < 0
            ? `prova ${Math.abs(selected.daysUntilGoal)} dias atrasada`
            : `prova em ${selected.daysUntilGoal} ${selected.daysUntilGoal === 1 ? "dia" : "dias"}`);
      } else if (selected.goal) {
        reasonParts.push(`meta “${selected.goal.title}”`);
      }
      if (reasonParts.length === 0) {
        reasonParts.push(selected.daysSinceActivity >= 14
          ? "assunto sem atividade recente"
          : "distribuição equilibrada entre seus assuntos");
      }

      position += 1;
      tasks.push({
        topic_id: selected.topic.id,
        goal_id: selected.goal?.id ?? null,
        task_date: taskDate,
        position,
        task_type: taskType,
        title: taskType === "review"
          ? `Revisar flashcards: ${selected.topic.name}`
          : taskType === "practice"
            ? `Praticar: ${selected.topic.name}`
            : `Estudar: ${selected.topic.name}`,
        duration_minutes: duration,
        priority_score: Math.round(selected.score * 100) / 100,
        recommendation_reason: `Prioridade ${Math.round(selected.score)}/100 · ${reasonParts.join(" · ")}.`,
      });

      countsByTopic.set(selected.topic.id, (countsByTopic.get(selected.topic.id) ?? 0) + 1);
      pendingByTopic.set(selected.topic.id, Math.max(0, (pendingByTopic.get(selected.topic.id) ?? 0) - 1));
      if (selected.due && selected.due.count > 0) {
        selected.due.count -= 1;
        if (selected.due.count === 0) dueByTopic.delete(selected.topic.id);
      }
    }
  }

  return {
    startDate,
    endDate,
    tasks,
    summary: {
      algorithmVersion: "v1",
      totalTasks: tasks.length,
      totalMinutes: tasks.reduce((total, task) => total + task.duration_minutes, 0),
      scheduledDays: new Set(tasks.map((task) => task.task_date)).size,
      goalCount: input.goals.length,
    },
  };
}
