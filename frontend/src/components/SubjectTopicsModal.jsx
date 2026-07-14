import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import { updateSubjectTopics } from '../services/subjectService.js';
import { getErrorMessage } from '../utils/helpers.js';

const SubjectTopicsModal = ({ show, subject, onClose, onSaved }) => {
  const [topics, setTopics] = useState([]);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!show) return;
    setTopics([...(subject?.topics || [])]);
    setDraft('');
    setError('');
  }, [show, subject]);

  const addTopic = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (topics.some((topic) => topic.toLowerCase() === trimmed.toLowerCase())) {
      setError('That topic is already in the list.');
      return;
    }
    setTopics((prev) => [...prev, trimmed]);
    setDraft('');
    setError('');
  };

  const updateTopicAt = (index, value) => {
    setTopics((prev) => prev.map((topic, i) => (i === index ? value : topic)));
  };

  const removeTopicAt = (index) => {
    setTopics((prev) => prev.filter((_, i) => i !== index));
  };

  const moveTopic = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= topics.length) return;
    setTopics((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item);
      return copy;
    });
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const cleaned = topics.map((topic) => topic.trim()).filter(Boolean);
    setSaving(true);
    setError('');
    try {
      const updated = await updateSubjectTopics(subject._id, cleaned);
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} title={`Topics — ${subject?.name || ''}`} onClose={onClose} size="toms-modal-lg" scrollable>
      <form onSubmit={handleSave}>
        <div className="toms-modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <p className="text-muted small mb-3">
            These topics appear in the topic tracker dropdown for this subject.
            Changes apply to all trainers going forward.
          </p>

          <div className="d-flex gap-2 mb-3">
            <input
              type="text"
              className="form-control"
              placeholder="Add a topic..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTopic();
                }
              }}
            />
            <button type="button" className="btn btn-outline-primary text-nowrap" onClick={addTopic}>
              Add topic
            </button>
          </div>

          {topics.length === 0 ? (
            <div className="text-muted small">No topics yet. Add topics or leave empty for free-text entry.</div>
          ) : (
            <div className="list-group">
              {topics.map((topic, index) => (
                <div key={`${index}-${topic.slice(0, 12)}`} className="list-group-item">
                  <div className="d-flex gap-2 align-items-start">
                    <span className="text-muted small pt-2" style={{ minWidth: '2rem' }}>{index + 1}.</span>
                    <textarea
                      className="form-control form-control-sm"
                      rows={2}
                      value={topic}
                      onChange={(e) => updateTopicAt(index, e.target.value)}
                      aria-label={`Topic ${index + 1}`}
                    />
                    <div className="btn-group-vertical btn-group-sm">
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => moveTopic(index, -1)}
                        disabled={index === 0}
                        aria-label={`Move topic ${index + 1} up`}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => moveTopic(index, 1)}
                        disabled={index === topics.length - 1}
                        aria-label={`Move topic ${index + 1} down`}
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-danger"
                        onClick={() => removeTopicAt(index)}
                        aria-label={`Remove topic ${index + 1}`}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="toms-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : `Save ${topics.length} topic${topics.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default SubjectTopicsModal;
