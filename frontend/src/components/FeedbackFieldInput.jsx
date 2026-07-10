const RatingInput = ({ value, onChange, disabled = false }) => (
  <div className="feedback-rating-row">
    {[1, 2, 3, 4, 5].map((score) => (
      <button
        key={score}
        type="button"
        className={`feedback-rating-btn ${Number(value) === score ? 'active' : ''}`}
        onClick={() => !disabled && onChange(score)}
        disabled={disabled}
        aria-label={`Rate ${score} out of 5`}
      >
        {score}
      </button>
    ))}
  </div>
);

const FeedbackFieldInput = ({ field, value, onChange, disabled = false }) => {
  if (field.type === 'paragraph') {
    return (
      <textarea
        className="form-control"
        rows={4}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={field.required}
      />
    );
  }

  if (field.type === 'rating') {
    return <RatingInput value={value} onChange={onChange} disabled={disabled} />;
  }

  if (field.type === 'multiple_choice') {
    return (
      <div className="d-flex flex-column gap-2">
        {(field.options || []).map((option) => (
          <label key={option} className="form-check">
            <input
              className="form-check-input"
              type="radio"
              name={field.id}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              disabled={disabled}
              required={field.required}
            />
            <span className="form-check-label">{option}</span>
          </label>
        ))}
      </div>
    );
  }

  return (
    <input
      type="text"
      className="form-control"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      required={field.required}
    />
  );
};

export const FeedbackFieldPreview = ({ field, value, onChange, preview = false }) => (
  <div className={`feedback-question-card ${preview ? '' : 'is-focused'}`}>
    <label className="d-block">
      {field.label}
      {field.required && <span className="text-danger ms-1">*</span>}
    </label>
    <FeedbackFieldInput field={field} value={value} onChange={onChange} disabled={preview} />
  </div>
);

export default FeedbackFieldInput;
