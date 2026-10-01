export const canUseAiAssistant = (user) => Boolean(user
  && ['admin', 'subject_coordinator'].includes(user.role)
  && !user.impersonating && !user.impersonator
  && !user.mustResetPassword && !user.requiresPasswordReset);

export const AI_SUGGESTED_QUESTIONS = [
  'Which trainers are in class right now?',
  'What replacements are assigned today?',
  'What special classes are scheduled today?',
];
