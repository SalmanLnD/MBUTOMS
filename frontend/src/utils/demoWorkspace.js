// Demo mutations use this adapter instead of Axios' network adapter. Only local
// changes are persisted; live responses are held in memory, separated by account.
export const isDemoUser = (user) => Boolean(user?.isDemo || user?.role === 'demo' || user?.accountRole === 'demo');
export const demoNetworkActions = new Set(['/auth/login', '/auth/logout', '/auth/impersonate', '/auth/stop-impersonation', '/ai/chat']);
const clone = (value) => JSON.parse(JSON.stringify(value));
const idOf = (value) => String(value?._id || value?.id || value?.specialGroupId || value || '');
const empty = () => ({ records: {}, created: {}, deleted: [], attendance: {}, tracker: {}, marks: {}, observations: {}, plp: {}, replacements: {}, sheets: {}, responses: {} });
const keys = { trainers: 'trainers', subjects: 'subjects', venues: 'venues', schedules: 'schedules', classes: 'classes', students: 'students', leaves: 'leaves', tickets: 'tickets', 'comp-offs': 'compOffs', holidays: 'holidays', forms: 'forms', compliance: 'items', 'trainer-punch-logs': 'logs', 'special-classes': 'specialClasses', 'class-cancellations': 'cancellations' };
const resource = (path) => {
  const parts = path.split('/').filter(Boolean);
  const sub = ['holidays', 'trainer-punch-logs', 'special-classes', 'class-cancellations', 'forms', 'compliance'].includes(parts[1]);
  return { name: sub ? parts[1] : parts[0], id: parts[sub ? 2 : 1], action: parts.slice(sub ? 3 : 2).join('/') };
};

export const createDemoWorkspace = (storage, notify = () => {}) => {
  const snapshots = new Map();
  const stateKey = (owner) => `toms_demo_workspace:${owner}:1`;
  const read = (owner) => {
    const raw = storage.getItem(stateKey(owner));
    try { return { ...empty(), ...JSON.parse(raw || '{}') }; } catch { return empty(); }
  };
  const save = (owner, state) => { storage.setItem(stateKey(owner), JSON.stringify(state)); notify(); };
  const snapshotKey = (owner, path, params = {}) => `${owner}|${path}|${JSON.stringify(Object.entries(params).sort())}`;
  const known = (owner, id) => {
    let result;
    const find = (data) => {
      if (!data || typeof data !== 'object') return;
      if (idOf(data._id || data.id || data.specialGroupId || data.entryId) === id) result = data;
      Object.values(data).forEach(find);
    };
    for (const [key, value] of snapshots) if (key.startsWith(`${owner}|`)) find(value);
    return result || {};
  };
  const merge = (value, state) => {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.filter(item => !state.deleted.includes(idOf(item))).map(item => merge(item, state));
    const patch = state.records[idOf(value._id || value.id || value.specialGroupId)] || {};
    return Object.fromEntries(Object.entries({ ...value, ...patch }).map(([key, item]) => [key, mergeChild(item, state)]));
  };
  // A record patch is applied once, including to populated nested references.
  const mergeChild = (value, state) => merge(value, state);
  const remember = (owner, path, params, data) => {
    if (data && typeof data === 'object' && !(typeof Blob !== 'undefined' && data instanceof Blob)) snapshots.set(snapshotKey(owner, path, params), clone(data));
  };
  const project = (owner, path, params = {}, data) => {
    if (!data || typeof data !== 'object' || (typeof Blob !== 'undefined' && data instanceof Blob)) return data;
    const state = read(owner); let result = merge(clone(data), state);
    const { name, id } = resource(path);
    const collection = keys[name];
    if (collection && (!id || name === 'class-cancellations' && id === 'options')) {
      const list = Array.isArray(result) ? result : result[collection];
      if (Array.isArray(list)) {
        const matches = (record) => Object.entries(params).every(([key, value]) => {
          if (!value || ['page','limit','sort','refresh'].includes(key)) return true;
          if (key === 'search') return JSON.stringify(record).toLowerCase().includes(String(value).toLowerCase());
          if (!(key in record)) return true;
          return idOf(record[key]) === String(value);
        });
        const additions = (state.created[name] || []).map(id => state.records[id]).filter(row => !state.deleted.includes(row._id) && !list.some(item => item._id === row._id) && matches(row));
        const combined = [...additions, ...list];
        if (Array.isArray(result)) result = combined;
        else {
          result[collection] = combined;
          if (result.pagination) result.pagination.total = Math.max(0, (result.pagination.total || 0) + additions.length - ((data[collection]?.length || 0) - list.length));
        }
      }
    }
    if (path === '/attendance/trainer-grid') {
      for (const row of result.rows || []) for (const [key, cell] of Object.entries(state.attendance)) {
        const [trainer, date] = key.split('|');
        if (idOf(row.trainer) === trainer && date.startsWith(result.month)) row.days[date] = { ...row.days[date], ...cell };
      }
    }
    if (path === '/topic-tracker/sessions') result.sessions = (result.sessions || []).map(row => ({ ...row, ...state.tracker[`${row.scheduleId}|${row.date}`] }));
    if (path === '/student-test-reports/grid') for (const row of result.students || []) {
      const key = `${params.month}|${params.subject}|${row._id}`;
      if (state.marks[key]) {
        const entry = state.marks[key], percentage = entry.attendance === 'A' ? null : Math.round(Number(entry.marksObtained) / Number(entry.maxMarks) * 100);
        row.report = { ...row.report, ...entry, percentage, result: entry.attendance === 'A' ? 'Absent' : percentage >= 50 ? 'Pass' : 'Fail' };
      }
    }
    if (path === '/observations') result.trainers = (result.trainers || []).map(row => ({ ...row, ...state.observations[`${result.monthKey}|${result.type}|${row.trainerId}`] }));
    if (path === '/plp') {
      if (state.plp.weightages) result.weightages = state.plp.weightages;
      result.rows = (result.rows || []).map(row => {
        const patch = state.plp[`${result.cycleKey}|${row.trainerId}`];
        return patch ? { ...row, manualFinal: patch.clear ? null : Number(patch.finalRating), isManualFinal: !patch.clear, finalPlpRating: patch.clear ? row.calculatedFinal : Number(patch.finalRating) } : row;
      });
    }
    if (path === '/replacements/all' || path === '/replacements/pending') result.replacements = (result.replacements || []).map(row => {
      const patch = state.replacements[`${idOf(row.leave)}|${idOf(row.schedule)}`];
      if (!patch) return row;
      return { ...row, replacement: patch.removed ? null : { ...(known(owner, patch.replacementTrainerId) || {}), trainerId: patch.replacementTrainerId, name: patch.externalTrainerName || known(owner, patch.replacementTrainerId).name || 'Demo replacement', isExternal: Boolean(patch.isExternal) } };
    });
    if (path.endsWith('/sheets/status') || path === '/sheets/timetable/status') result = { ...result, ...state.sheets[path] };
    if (state.responses[path]) result = { ...result, ...state.responses[path] };
    return result;
  };
  const mutate = (owner, path, method, payload = {}) => {
    if (typeof payload === 'string') payload = JSON.parse(payload || '{}');
    if (typeof FormData !== 'undefined' && payload instanceof FormData) throw new Error('File uploads are unavailable in the local demo. You can add and edit individual records.');
    const body = clone(payload || {}), state = read(owner), route = resource(path);
    const makeId = () => `demo-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
    const message = 'Saved in this browser only. Live data is unchanged.';
    let result = { message, localOnly: true };
    if (path === '/attendance/trainer-daily') {
      const key = `${idOf(body.trainer)}|${body.date}`;
      result = { ...body, id: state.attendance[key]?.id || makeId(), oifDisplay: body.oifNumber, classHoursEditable: true, message, localOnly: true };
      state.attendance[key] = result;
    } else if (path === '/topic-tracker/entries') {
      const key = `${body.scheduleId}|${body.date}`;
      const minutes = time => Number(time?.split(':')[0] || 0) * 60 + Number(time?.split(':')[1] || 0);
      result = { ...body, _id: state.tracker[key]?.entryId || makeId(), durationHrs: Math.max(0,(minutes(body.sessionEndTime)-minutes(body.sessionStartTime))/60), attendancePercent: body.allottedStudents ? Math.round(body.noPresent / body.allottedStudents * 100) : 0, message, localOnly: true };
      state.tracker[key] = { ...result, entryId: result._id };
    } else if (path === '/student-test-reports/bulk') {
      for (const entry of body.entries || []) state.marks[`${body.month}|${body.subject}|${entry.studentId}`] = entry;
      result.saved = body.entries?.length || 0;
    } else if (path.startsWith('/observations/')) {
      result = { ...body, trainerId: route.id, updatedAt: new Date().toISOString(), message, localOnly: true };
      state.observations[`${body.monthKey}|${body.type}|${route.id}`] = result;
    } else if (path === '/plp/weightages') {
      state.plp.weightages = body;
      result.weightages = body;
    } else if (path.startsWith('/plp/') && route.action === 'final') {
      const cycleKey = body.cycleKey || body.cycle || body.month;
      state.plp[`${cycleKey}|${route.id}`] = body;
      result = { ...result, ...body, cycleKey, trainerId: route.id, isManualFinal: !body.clear, cleared: Boolean(body.clear), row: { trainerId: route.id, manualFinal: body.clear ? null : Number(body.finalRating), finalPlpRating: body.clear ? 0 : Number(body.finalRating), isManualFinal: !body.clear } };
    } else if (path.startsWith('/topic-tracker/entries/')) {
      const entryId = path.split('/')[3], live = known(owner, entryId);
      if (live.scheduleId && live.date) state.tracker[`${live.scheduleId}|${live.date}`] ||= live;
      for (const [key, value] of Object.entries(state.tracker)) if (value.entryId === entryId) {
        state.tracker[key] = { ...value, ...(path.endsWith('/status') ? { trackerStatus: body.status } : { cancellationApprovalStatus: body.status }) };
      }
    } else if (path.endsWith('/sheets/link') || path === '/sheets/timetable/link') {
      const status = path.replace(/\/link$/, '/status');
      result = { ...result, linked: method !== 'delete', spreadsheetUrl: method !== 'delete' ? body.spreadsheetUrl : null, linkedAt: new Date().toISOString() };
      state.sheets[status] = result;
    } else if (path === '/notifications/read-all' || path.endsWith('/read')) {
      if (route.id && route.id !== 'read-all') state.records[route.id] = { ...known(owner, route.id), isRead: true };
      else state.responses['/notifications'] = { notifications: [], unreadCount: 0 };
    } else if (path === '/attendance/whatsapp-sync') {
      result = { ...result, message: 'Demo sync simulated locally. No WhatsApp job was sent.', job: { _id: makeId(), status: 'completed', result: { localOnly: true } } };
      state.responses['/attendance/whatsapp-sync/status'] = result;
    } else if (path.startsWith('/replacements/')) {
      // Replacement controls send no bridge/database requests in demo mode.
      const assignments = body.assignments || [body];
      for (const assignment of assignments) state.replacements[`${assignment.leaveId || body.leaveId}|${assignment.scheduleId}`] = { ...assignment, removed: ['cancel','remove'].includes(route.id) };
      result = { ...result, ...body, replacements: assignments, assigned: assignments.length };
    } else if (keys[route.name]) {
      const id = route.id || makeId();
      const base = state.records[id] || known(owner, id);
      let patch = { ...body };
      if (route.action === 'resign') patch = { ...patch, employmentStatus: 'resigned' };
      if (route.action === 'permanent-replacement') patch = { ...patch, employmentStatus: 'resigned', successorTrainer: known(owner, body.replacementTrainerId) };
      if (route.action === 'approve') patch.status = 'approved';
      if (route.action === 'reject') patch.status = 'rejected';
      if (route.action === 'reset-password') patch = {};
      if (route.action === 'topics') patch = { topics: body.topics };
      result = { ...base, ...patch, _id: id, createdAt: base.createdAt || new Date().toISOString(), message, localOnly: true };
      if (route.name === 'special-classes') result = { ...result, specialGroupId: id, days: body.days || [new Date(body.date).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })], startDate: body.startDate || body.date, endDate: body.endDate || body.date, trainerName: known(owner, body.trainerId).name || body.trainerCode, subjectCode: known(owner, body.subjectId).code || '', scheduleIds: base.scheduleIds || [] };
      // Keep references populated where the real API returns populated objects.
      for (const field of ['subjects', 'subject', 'trainer', 'venue', 'semester', 'school', 'schools']) {
        if (typeof result[field] === 'string') result[field] = state.records[result[field]] || known(owner, result[field])._id && known(owner, result[field]) || result[field];
        else if (Array.isArray(result[field])) result[field] = result[field].map(item => typeof item === 'string' ? state.records[item] || known(owner, item)._id && known(owner, item) || item : item);
      }
      state.records[id] = result;
      if (method === 'delete') state.deleted = [...new Set([...state.deleted, id])];
      else if (!route.id) state.created[route.name] = [...state.created[route.name] || [], id];
    } else {
      // Unsupported network operations fail closed while their local form state
      // remains intact. Do not pretend a server-only integration has succeeded.
      throw new Error('This action is not available in the local demo. No data was sent to the server.');
    }
    save(owner, state);
    return result;
  };
  const localDetail = (owner, path) => {
    const { id } = resource(path);
    if (!id?.startsWith('demo-')) return null;
    return read(owner).records[id] || null;
  };
  return { remember, project, mutate, localDetail,
    reset(owner) { storage.removeItem(stateKey(owner)); for (const key of snapshots.keys()) if (key.startsWith(`${owner}|`)) snapshots.delete(key); notify(); },
    count(owner) { const s = read(owner); return Object.keys(s.records).length + Object.keys(s.attendance).length + Object.keys(s.tracker).length + Object.keys(s.marks).length + Object.keys(s.observations).length + Object.keys(s.plp).length; },
  };
};
