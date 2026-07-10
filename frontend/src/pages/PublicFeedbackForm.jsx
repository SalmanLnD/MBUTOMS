import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { FeedbackFieldPreview } from '../components/FeedbackFieldInput.jsx';
import { getPublicFeedbackForm, submitPublicFeedback } from '../services/feedbackService.js';
import { showError } from '../utils/toast.js';
import { getErrorMessage } from '../utils/helpers.js';
import '../styles/feedback-forms.css';

const isRequiredAnswerMissing = (field, value) => {
  if (field.type === 'rating') {
    const rating = Number(value);
    return !Number.isFinite(rating) || rating < 1 || rating > 5;
  }
  return String(value ?? '').trim() === '';
};

const PublicFeedbackForm = () => {
  const { slug } = useParams();
  const [form, setForm] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await getPublicFeedbackForm(slug);
        setForm(data);
      } catch (err) {
        showError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  const handleChange = (fieldId, value) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const sortedFields = [...(form.fields || [])].sort((a, b) => a.order - b.order);
    const missingField = sortedFields.find(
      (field) => field.required && isRequiredAnswerMissing(field, answers[field.id])
    );
    if (missingField) {
      showError(`"${missingField.label}" is required`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = (form.fields || []).map((field) => ({
        fieldId: field.id,
        value: answers[field.id] ?? '',
      }));
      await submitPublicFeedback(slug, payload);
      setSubmitted(true);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="feedback-public-page">
        <LoadingSpinner message="Loading form..." />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="feedback-public-page">
        <div className="feedback-form-shell">
          <div className="feedback-form-header">
            <h1>Form not found</h1>
            <p className="text-muted mb-0">This feedback link may be invalid or no longer published.</p>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="feedback-public-page">
        <div className="feedback-form-shell feedback-public-success">
          <div className="feedback-form-header">
            <h1>Response recorded</h1>
            <p className="text-muted mb-0">Thank you for submitting your feedback.</p>
          </div>
        </div>
      </div>
    );
  }

  const sortedFields = [...(form.fields || [])].sort((a, b) => a.order - b.order);

  return (
    <div className="feedback-public-page">
      <form className="feedback-form-shell" onSubmit={handleSubmit}>
        <div className="feedback-form-header">
          <h1>{form.title}</h1>
          {form.description && <p className="text-muted mb-0">{form.description}</p>}
        </div>

        {sortedFields.map((field) => (
          <FeedbackFieldPreview
            key={field.id}
            field={field}
            value={answers[field.id]}
            onChange={(value) => handleChange(field.id, value)}
            trainers={form.trainers || []}
          />
        ))}

        <div className="d-flex justify-content-end">
          <button type="submit" className="btn btn-primary px-4" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PublicFeedbackForm;
