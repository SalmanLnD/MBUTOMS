import { Link } from 'react-router-dom';
import AsyncButton from './AsyncButton.jsx';

const ActionIconButton = ({
  variant = 'edit',
  icon: Icon,
  title,
  'aria-label': ariaLabel,
  onClick,
  to,
  className = '',
  ...props
}) => {
  const classes = [
    'btn',
    'btn-sm',
    'action-btn',
    `action-btn-${variant}`,
    'd-inline-flex',
    'align-items-center',
    'justify-content-center',
    className,
  ].filter(Boolean).join(' ');

  const label = ariaLabel || title;
  const content = <Icon size={16} />;

  if (to) {
    return (
      <Link
        to={to}
        className={classes}
        title={title}
        aria-label={label}
        {...props}
      >
        {content}
      </Link>
    );
  }

  return (
    <AsyncButton
      type="button"
      className={classes}
      title={title}
      aria-label={label}
      onClick={onClick}
      {...props}
    >
      {content}
    </AsyncButton>
  );
};

export default ActionIconButton;
