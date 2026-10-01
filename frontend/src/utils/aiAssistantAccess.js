export const canUseAiAssistant = (user) => Boolean(user
  && ['admin', 'subject_coordinator', 'trainer', 'evaluator', 'manager', 'campus_manager'].includes(user.role)
  && !user.impersonating && !user.impersonator
  && !user.mustResetPassword && !user.requiresPasswordReset);

export const AI_SUGGESTED_QUESTIONS = [
  'What is my timetable today?',
  'How many class-handling hours do I have this week?',
  'Show my attendance for today.',
];
