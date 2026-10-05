import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { visibleViewport } from '../utils/popoverPosition.js';

const TopicTitleGuide = ({ label, anchor, id }) => {
  const guide = useRef(null);
  const [position, setPosition] = useState({ top: 8, left: 8 });
  useLayoutEffect(() => {
    const fit = () => {
      if (!anchor?.isConnected || !guide.current) return;
      const view = visibleViewport(), rect = anchor.getBoundingClientRect();
      const x = view.offsetLeft || 0, y = view.offsetTop || 0;
      const width = Math.min(320, view.width - 16), height = guide.current.offsetHeight;
      const menuRect = anchor.closest('[role="listbox"]')?.getBoundingClientRect();
      const bounds = menuRect || rect;
      const rightFits = bounds.right + 8 + width <= x + view.width - 8;
      const leftFits = bounds.left - width - 8 >= x + 8;
      const beside = menuRect && (rightFits || leftFits);
      const below = bounds.bottom + 8;
      setPosition({ width,
        left: beside ? (rightFits ? bounds.right + 8 : bounds.left - width - 8)
          : Math.max(x + 8, Math.min(bounds.left, x + view.width - width - 8)),
        top: Math.max(y + 8, Math.min(beside ? rect.top : below + height <= y + view.height - 8 ? below : bounds.top - height - 8, y + view.height - height - 8)),
      });
    };
    fit(); window.addEventListener('resize', fit); window.addEventListener('scroll', fit, true);
    return () => { window.removeEventListener('resize', fit); window.removeEventListener('scroll', fit, true); };
  }, [anchor, label, position.width]);
  return createPortal(<div ref={guide} id={id} role="tooltip" className="topic-title-guide" aria-label={label}
    style={{ ...position, '--topic-guide-width': `${(position.width || 320) - 16}px`, '--topic-scroll-duration': `${Math.max(7, label.length * .1)}s` }}>
    <div className="topic-title-guide__ticker"><span key={label}>{label}</span></div>
  </div>, document.body);
};
export default TopicTitleGuide;
