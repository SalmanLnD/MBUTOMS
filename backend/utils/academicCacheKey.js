import { getAcademicTermContext } from './academicTermContext.js';

// Process-local reports must never be reused across private semester views.
export const academicCacheKey = (key) => {
  const context = getAcademicTermContext();
  const term = context?.term;
  return JSON.stringify([String(term?._id || ''), term?.routingRevision || 0, context?.revision || 0, key]);
};

export const academicSettingKey = (key) => {
  const term = getAcademicTermContext()?.term;
  return term?._id ? `term:${term._id}:${key}` : key;
};

export const academicExportUrl = (url) => {
  const term = getAcademicTermContext()?.term;
  return term?._id ? `${url}?termId=${encodeURIComponent(String(term._id))}` : url;
};
