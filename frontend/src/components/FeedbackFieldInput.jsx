import StyledSelect from './StyledSelect.jsx';

export const FEEDBACK_SEMESTER_OPTIONS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

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

const FeedbackFieldInput = ({
  field,
  value,
  onChange,
  disabled = false,
  trainers = [],
  classes = [],
  semesters = FEEDBACK_SEMESTER_OPTIONS,
}) => {
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

  if (field.type === 'trainer_select') {
    const trainerOptions = trainers.map((trainer) => ({
      value: trainer._id,
      label: `${trainer.name}${trainer.employeeId ? ` (${trainer.employeeId})` : ''}`,
    }));

    return (
      <StyledSelect
        name={field.id}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={field.required}
        placeholder="Select trainer"
        options={trainerOptions}
        aria-label={field.label}
      />
    );
  }

  if (field.type === 'class_select') {
    const classOptions = classes.map((cls) => ({
      value: cls.label || `${cls.department || ''} ${cls.section || ''}`.trim(),
      label: cls.label || `${cls.department || ''} ${cls.section || ''}`.trim(),
    })).filter((option) => option.value);

    return (
      <StyledSelect
        name={field.id}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={field.required}
        placeholder="Select class"
        options={classOptions}
        aria-label={field.label}
      />
    );
  }

  if (field.type === 'semester_select') {
    const semesterOptions = (semesters.length ? semesters : FEEDBACK_SEMESTER_OPTIONS).map((semester) => ({
      value: semester,
      label: semester,
    }));

    return (
      <StyledSelect
        name={field.id}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={field.required}
        placeholder="Select semester"
        options={semesterOptions}
        aria-label={field.label}
      />
    );
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

export const FeedbackFieldPreview = ({
  field,
  value,
  onChange,
  preview = false,
  trainers = [],
  classes = [],
  semesters = FEEDBACK_SEMESTER_OPTIONS,
}) => (
  <div className={`feedback-question-card ${preview ? '' : 'is-focused'}`}>
    <label className="d-block">
      {field.label}
      {field.required && <span className="text-danger ms-1">*</span>}
    </label>
    <FeedbackFieldInput
      field={field}
      value={value}
      onChange={onChange}
      disabled={preview}
      trainers={trainers}
      classes={classes}
      semesters={semesters}
    />
  </div>
);

export default FeedbackFieldInput;
