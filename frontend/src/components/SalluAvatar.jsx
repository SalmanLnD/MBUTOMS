import '../styles/sallu-avatar.css';

const SalluAvatar = ({ size = 36 }) => (
  <svg className="sallu-avatar" width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">
    <circle cx="24" cy="24" r="24" fill="#E4F0F0" />
    <path d="M10 43c1-8 6-12 14-12s13 4 14 12" fill="#245364" />
    <rect x="12" y="10" width="24" height="25" rx="11" fill="#FFF9EE" />
    <path d="M12 22v-5c0-7 5-11 12-11s12 4 12 11v5l-4-8c-4 4-10 5-17 4l-3 4Z" fill="#193653" />
    <circle cx="19" cy="23" r="1.5" fill="#193653" />
    <circle cx="29" cy="23" r="1.5" fill="#193653" />
    <path d="M20 28c2 2 6 2 8 0" stroke="#245364" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M11 21v5m26-5v5" stroke="#498B91" strokeWidth="3" strokeLinecap="round" />
    <path d="M37 26c0 4-3 5-8 5" stroke="#498B91" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="26" y="29.5" width="5" height="3" rx="1.5" fill="#498B91" />
  </svg>
);

export default SalluAvatar;
