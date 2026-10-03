import '../styles/sallu-avatar.css';
const SalluAvatar = ({ size = 36, state = 'idle' }) => (
  <span className={`sallu-avatar sallu-avatar--${state}`} style={{ width: size, height: size }} aria-hidden="true">
    <span className="sallu-avatar__portrait" />
  </span>
);
export default SalluAvatar;
