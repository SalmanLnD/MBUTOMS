const cleanTopic = (value) => String(value ?? '').trim();

export const normalizeTopicModulesCovered = (topics, legacyTopic = '') => {
  const source = Array.isArray(topics) ? topics : [legacyTopic];
  const unique = new Set();

  source.forEach((topic) => {
    const cleaned = cleanTopic(topic);
    if (cleaned) unique.add(cleaned);
  });

  return [...unique];
};

export const getEntryTopicModules = (entry) =>
  normalizeTopicModulesCovered(entry?.topicModulesCovered, entry?.topicModuleCovered);

export const formatTopicModulesCovered = (topics, legacyTopic = '') =>
  normalizeTopicModulesCovered(topics, legacyTopic).join(', ');
