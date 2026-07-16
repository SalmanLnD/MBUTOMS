import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

const PageTitleContext = createContext(null);

const ROUTE_TITLES = [
  { path: '/dashboard', title: 'Dashboard' },
  { path: '/trainers/', title: 'Trainer Profile' },
  { path: '/trainers', title: 'Trainers' },
  { path: '/classes-students', title: 'Classes & Students' },
  { path: '/leaves', title: 'Leave Management' },
  { path: '/tickets', title: 'Support Tickets' },
  { path: '/topic-tracker', title: 'Topic Tracker' },
  { path: '/replacements', title: 'Replacements' },
  { path: '/performance', title: 'Performance' },
  { path: '/subjects', title: 'Subjects' },
  { path: '/venues', title: 'Venues' },
  { path: '/timetable', title: 'Timetable' },
];

const resolveRouteTitle = (pathname) => {
  if (pathname.endsWith('/schedule') && pathname.startsWith('/trainers/')) {
    return 'Trainer Schedule';
  }
  const match = ROUTE_TITLES.find((entry) =>
    entry.path.endsWith('/') ? pathname.startsWith(entry.path) : pathname === entry.path
  );
  return match?.title || '';
};

export const PageTitleProvider = ({ children }) => {
  const { pathname } = useLocation();
  const [override, setOverride] = useState('');

  useEffect(() => {
    setOverride('');
  }, [pathname]);

  const value = useMemo(
    () => ({
      title: override || resolveRouteTitle(pathname),
      setTitle: setOverride,
    }),
    [override, pathname]
  );

  return <PageTitleContext.Provider value={value}>{children}</PageTitleContext.Provider>;
};

export const usePageTitleValue = () => {
  const context = useContext(PageTitleContext);
  return context?.title ?? '';
};

/** Pages with dynamic titles call this to override the route default. */
export const usePageTitle = (title) => {
  const context = useContext(PageTitleContext);
  const setTitle = context?.setTitle;
  useEffect(() => {
    if (!setTitle || !title) return;
    setTitle(title);
  }, [setTitle, title]);
};
