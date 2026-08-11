import api from './api.js';

export const BULK_IMPORT_BATCH_SIZE = 50;

const chunkArray = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

export const getStudents = async (params = {}) => {
  const { data } = await api.get('/students', { params });
  return data;
};

export const getStudentById = async (id) => {
  const { data } = await api.get(`/students/${id}`);
  return data;
};

export const createStudent = async (studentData) => {
  const { data } = await api.post('/students', studentData);
  return data;
};

export const updateStudent = async (id, studentData) => {
  const { data } = await api.put(`/students/${id}`, studentData);
  return data;
};

export const deleteStudent = async (id) => {
  const { data } = await api.delete(`/students/${id}`);
  return data;
};

export const downloadStudentBulkTemplate = async () => {
  const { data } = await api.get('/students/bulk/template', {
    responseType: 'blob',
  });
  return data;
};

export const parseBulkUploadFile = async (file, { onUploadProgress } = {}) => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/students/bulk/parse', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  });
  return data;
};

export const importBulkStudentBatch = async (rows, { updateExisting = false } = {}) => {
  const { data } = await api.post('/students/bulk/import-batch', {
    rows,
    updateExisting,
  });
  return data;
};

export const bulkUploadStudents = async (file, { updateExisting = false, onProgress } = {}) => {
  const parsed = await parseBulkUploadFile(file, {
    onUploadProgress: (event) => {
      if (!event.total) return;
      const percent = Math.min(40, Math.round((event.loaded / event.total) * 40));
      onProgress?.({
        phase: 'uploading',
        percent,
        label: 'Uploading file…',
      });
    },
  });

  const validRows = parsed.validRows || [];
  const parseErrors = parsed.errors || [];
  const batchSize = parsed.batchSize || BULK_IMPORT_BATCH_SIZE;

  if (!validRows.length) {
    const error = new Error(
      parseErrors.length
        ? 'No valid student rows found in the file'
        : 'No student rows found in the file'
    );
    error.response = { data: { errors: parseErrors } };
    throw error;
  }

  onProgress?.({
    phase: 'importing',
    percent: 40,
    label: 'Importing students…',
    batch: 0,
    totalBatches: Math.ceil(validRows.length / batchSize),
  });

  const batches = chunkArray(validRows, batchSize);
  const aggregate = {
    created: 0,
    updated: 0,
    skipped: 0,
    failed: parseErrors.length,
    errors: [...parseErrors],
  };

  for (let index = 0; index < batches.length; index += 1) {
    const batchResult = await importBulkStudentBatch(batches[index], { updateExisting });
    aggregate.created += batchResult.created || 0;
    aggregate.updated += batchResult.updated || 0;
    aggregate.skipped += batchResult.skipped || 0;
    aggregate.failed += batchResult.failed || 0;
    if (Array.isArray(batchResult.errors)) {
      aggregate.errors.push(...batchResult.errors);
    }

    const importPercent = 40 + Math.round(((index + 1) / batches.length) * 60);
    onProgress?.({
      phase: 'importing',
      percent: importPercent,
      label: `Importing students (${index + 1} of ${batches.length})…`,
      batch: index + 1,
      totalBatches: batches.length,
    });
  }

  return {
    message: `Import complete: ${aggregate.created} created, ${aggregate.updated} updated, ${aggregate.skipped} skipped, ${aggregate.failed} failed`,
    ...aggregate,
    errors: aggregate.errors.slice(0, 100),
  };
};
