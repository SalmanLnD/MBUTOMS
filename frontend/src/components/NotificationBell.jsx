import { useCallback, useEffect, useRef, useState } from 'react';
import { BellIcon, CheckReadIcon } from './icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLES } from '../utils/roles.js';
import { formatDateTime, getErrorMessage } from '../utils/helpers.js';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notificationService.js';
import { showError } from '../utils/toast.js';

const NotificationBell = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const rootRef = useRef(null);

  const canViewNotifications =
    user
    && !user.impersonating
    && (user.role === ROLES.ADMIN || user.role === ROLES.TRAINER);

  const loadNotifications = useCallback(async () => {
    if (!canViewNotifications) return;
    setLoading(true);
    try {
      const data = await getNotifications({ limit: 30 });
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [canViewNotifications]);

  useEffect(() => {
    if (!canViewNotifications) return undefined;
    loadNotifications();
    const intervalId = window.setInterval(loadNotifications, 45000);
    return () => window.clearInterval(intervalId);
  }, [canViewNotifications, loadNotifications]);

  useEffect(() => {
    if (!open) return undefined;

    const handleClickOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleToggle = () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) loadNotifications();
  };

  const handleMarkRead = async (notificationId) => {
    try {
      const data = await markNotificationRead(notificationId);
      setNotifications((current) =>
        current.map((item) =>
          item._id === notificationId ? { ...item, readAt: data.notification.readAt } : item
        )
      );
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      showError(getErrorMessage(err));
    }
  };

  const handleMarkAllRead = async () => {
    if (!unreadCount || markingAll) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt || now })));
      setUnreadCount(0);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setMarkingAll(false);
    }
  };

  if (!canViewNotifications) return null;

  return (
    <div className="notification-bell" ref={rootRef}>
      <button
        type="button"
        className="notification-bell-trigger"
        onClick={handleToggle}
        aria-expanded={open}
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      >
        <BellIcon size={18} />
        {unreadCount > 0 && (
          <span className="notification-bell-badge" aria-hidden="true">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-panel" role="dialog" aria-label="Notifications">
          <div className="notification-panel-header">
            <h2 className="notification-panel-title">Notifications</h2>
            <button
              type="button"
              className="btn btn-link btn-sm notification-mark-all"
              onClick={handleMarkAllRead}
              disabled={!unreadCount || markingAll}
            >
              Mark all as read
            </button>
          </div>

          <div className="notification-panel-body">
            {loading && !notifications.length ? (
              <p className="notification-empty text-muted mb-0">Loading notifications...</p>
            ) : !notifications.length ? (
              <p className="notification-empty text-muted mb-0">No notifications yet.</p>
            ) : (
              <ul className="notification-list list-unstyled mb-0">
                {notifications.map((notification) => {
                  const isUnread = !notification.readAt;
                  return (
                    <li
                      key={notification._id}
                      className={`notification-item ${isUnread ? 'notification-item--unread' : ''}`}
                    >
                      <div className="notification-item-content">
                        <p className="notification-item-message mb-1">{notification.message}</p>
                        <p className="notification-item-meta text-muted small mb-0">
                          {formatDateTime(notification.createdAt)}
                        </p>
                      </div>
                      {isUnread && (
                        <button
                          type="button"
                          className="notification-mark-read"
                          onClick={() => handleMarkRead(notification._id)}
                          aria-label="Mark as read"
                          title="Mark as read"
                        >
                          <CheckReadIcon size={16} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
