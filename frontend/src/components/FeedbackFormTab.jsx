import { useState, useEffect, useCallback } from 'react';
import LoadingSpinner from './LoadingSpinner.jsx';
import { FeedbackFieldPreview } from './FeedbackFieldInput.jsx';
import { CopyIcon } from './icons.jsx';
import {
  createCurrentMonthForm,
  getCurrentMonthForm,
  updateFeedbackForm,
  publishFeedbackForm,
} from '../services/feedbackService.js';
import { showError, showSuccess } from '../utils/toast.js';
import { getErrorMessage } from '../utils/helpers.js';
import '../styles/feedback-forms.css';

const FIELD_TYPES = [
  { value: 'short_text', label: 'Short answer' },
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'rating', label: 'Rating (1-5)' },
  { value: 'multiple_choice', label: 'Multiple choice' },
];

const FeedbackFormTab = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [monthLabel, setMonthLabel] = useState('');
  const [form, setForm] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  const loadForm = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCurrentMonthForm();
      setMonthLabel(data.monthLabel);
      setForm(data.form);
      if (data.form?.status === 'published' && data.form?.publicSlug) {
        setShareUrl(`${window.location.origin}/f/${data.form.publicSlug}`);
      }
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadForm();
  }, [loadForm]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const created = await createCurrentMonthForm();
      setForm(created);
      showSuccess('Feedback form created for current month');
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const updateField = (index, patch) => {
    setForm((prev) => {
      const fields = [...(prev.fields || [])];
      fields[index] = { ...fields[index], ...patch };
      return { ...prev, fields };
    });
  };

  const addField = (type) => {
    const id = `field_${Date.now()}`;
    setForm((prev) => ({
      ...prev,
      fields: [
        ...(prev.fields || []),
        {
          id,
          type,
          label: 'Untitled question',
          required: false,
          options: type === 'multiple_choice' ? ['Option 1'] : [],
          order: (prev.fields?.length || 0),
        },
      ],
    }));
  };

  const removeField = (index) => {
    setForm((prev) => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    if (!form?._id) return;
    setSaving(true);
    try {
      const updated = await updateFeedbackForm(form._id, {
        title: form.title,
        description: form.description,
        fields: form.fields,
      });
      setForm(updated);
      showSuccess('Form saved');
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!form?._id) return;
    setPublishing(true);
    try {
      if (form.status !== 'published') {
        await updateFeedbackForm(form._id, {
          title: form.title,
          description: form.description,
          fields: form.fields,
        });
      }
      const result = await publishFeedbackForm(form._id);
      setForm(result.form);
      const url = `${window.location.origin}${result.publicPath}`;
      setShareUrl(url);
      showSuccess('Form published');
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setPublishing(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      showSuccess('Link copied to clipboard');
    } catch {
      showError('Could not copy link');
    }
  };

  if (loading) return <LoadingSpinner />;

  if (!form) {
    return (
      <div className="text-center py-5">
        <h5 className="mb-2">No form for {monthLabel}</h5>
        <p className="text-muted mb-4">Create a feedback form for the current month with default questions.</p>
        <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={saving}>
          {saving ? 'Creating...' : 'Create form for current month'}
        </button>
      </div>
    );
  }

  const sortedFields = [...(form.fields || [])].sort((a, b) => a.order - b.order);
  const isPublished = form.status === 'published';

  return (
    <div>
      <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setPreviewMode((v) => !v)}>
          {previewMode ? 'Edit form' : 'Preview'}
        </button>
        {!isPublished && (
          <>
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save draft'}
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={handlePublish} disabled={publishing}>
              {publishing ? 'Publishing...' : 'Publish and share'}
            </button>
          </>
        )}
        {isPublished && (
          <span className="badge bg-success">Published</span>
        )}
      </div>

      {shareUrl && (
        <div className="feedback-share-box mb-3">
          <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
            <div>
              <div className="fw-medium">Share link</div>
              <a href={shareUrl} target="_blank" rel="noreferrer">{shareUrl}</a>
            </div>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleCopyLink}>
              <CopyIcon size={16} className="me-1" aria-hidden="true" />
              Copy link
            </button>
          </div>
        </div>
      )}

      <div className="feedback-form-shell">
        <div className="feedback-form-header">
          {!previewMode && !isPublished ? (
            <>
              <input
                className="form-control form-control-lg border-0 px-0 mb-2"
                value={form.title || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                aria-label="Form title"
              />
              <textarea
                className="form-control border-0 px-0"
                rows={2}
                value={form.description || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                aria-label="Form description"
              />
            </>
          ) : (
            <>
              <h1>{form.title}</h1>
              {form.description && <p className="text-muted mb-0">{form.description}</p>}
            </>
          )}
        </div>

        {sortedFields.map((field, index) => (
          previewMode || isPublished ? (
            <FeedbackFieldPreview key={field.id} field={field} value="" onChange={() => {}} preview />
          ) : (
            <div key={field.id} className="feedback-question-card">
              <div className="row g-2 align-items-start">
                <div className="col-md-8">
                  <input
                    className="form-control mb-2"
                    value={field.label}
                    onChange={(e) => updateField(index, { label: e.target.value })}
                    aria-label="Question label"
                  />
                  <select
                    className="form-select form-select-sm mb-2"
                    value={field.type}
                    onChange={(e) => updateField(index, {
                      type: e.target.value,
                      options: e.target.value === 'multiple_choice' ? ['Option 1'] : [],
                    })}
                  >
                    {FIELD_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                  {field.type === 'multiple_choice' && (
                    <textarea
                      className="form-control form-control-sm"
                      rows={3}
                      value={(field.options || []).join('\n')}
                      onChange={(e) => updateField(index, {
                        options: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                      })}
                      placeholder="One option per line"
                    />
                  )}
                  <FeedbackFieldPreview field={field} value="" onChange={() => {}} preview />
                </div>
                <div className="col-md-4 text-md-end">
                  <div className="form-check form-check-inline">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={Boolean(field.required)}
                      onChange={(e) => updateField(index, { required: e.target.checked })}
                      id={`required-${field.id}`}
                    />
                    <label className="form-check-label" htmlFor={`required-${field.id}`}>Required</label>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm ms-2"
                    onClick={() => removeField(index)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          )
        ))}

        {!previewMode && !isPublished && (
          <div className="feedback-builder-toolbar">
            {FIELD_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => addField(type.value)}
              >
                + {type.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedbackFormTab;
