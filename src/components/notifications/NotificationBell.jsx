// src/components/notifications/NotificationBell.jsx
//
// AppBar bell for the completed-work notifications feed (useNotifications).
// Clicking a notification marks it read (if not already) and deep-links to
// that mukkadam's detail page, Ledger tab — the natural place to act on it
// (e.g. release early). Unread state is per-user (read_by.name === my
// username), computed by the hook, not the feed's own shared `is_read`.
import { useState } from "react";
import { usePostHog } from "@posthog/react";
import { useNavigate } from "react-router-dom";
import {
  Badge,
  Box,
  Button,
  Divider,
  Fade,
  IconButton,
  Popover,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import { formatCurrency } from "../../utils/format";
import { formatRelativeTime } from "../../utils/relativeTime";
import { track } from "../../analytics/track";

function NotificationItem({ notification, read, onOpen }) {
  const payload = notification.message_payload || {};
  return (
    <Box
      onClick={() => onOpen(notification)}
      className="ph-no-capture"
      sx={{
        display: "flex",
        gap: 1.25,
        p: 1.5,
        cursor: "pointer",
        borderLeft: "3px solid",
        borderLeftColor: read ? "transparent" : "primary.main",
        bgcolor: read ? "transparent" : "action.hover",
        transition: "background-color 150ms ease",
        "&:hover": { bgcolor: "action.selected" },
      }}
    >
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          bgcolor: read ? "transparent" : "primary.main",
          mt: 0.75,
          flexShrink: 0,
        }}
      />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: read ? 400 : 600 }} noWrap>
          {payload.mukkadam_name || "A mukkadam"} completed {payload.activity_name || "work"}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }} noWrap>
          {[payload.plot_code, payload.variety].filter(Boolean).join(" · ")}
          {payload.amount != null ? ` · ${formatCurrency(payload.amount)}` : ""}
        </Typography>
        <Typography variant="caption" color="text.disabled">
          {formatRelativeTime(notification.created_at)}
        </Typography>
      </Box>
    </Box>
  );
}

export default function NotificationBell({ notifications, unreadCount, isReadByMe, markAsRead }) {
  const posthog = usePostHog();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  function handleOpenNotification(notification) {
    setAnchorEl(null);
    if (!isReadByMe(notification)) markAsRead([notification.id]);
    const mukkadamId = notification.mukkadam_id ?? notification.message_payload?.mukkadam_id;
    track(posthog, "notification_opened", { notification_id: notification.id, mukkadam_id: mukkadamId });
    if (mukkadamId) navigate(`/mukkadams/${mukkadamId}?tab=ledger`);
  }

  function handleMarkAllRead(e) {
    e.stopPropagation();
    const ids = notifications.filter((n) => !isReadByMe(n)).map((n) => n.id);
    track(posthog, "notifications_mark_all_read_clicked", { count: ids.length });
    markAsRead(ids);
  }

  function handleOpenBell(e) {
    track(posthog, "notification_bell_opened", { unread_count: unreadCount });
    setAnchorEl(e.currentTarget);
  }

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          onClick={handleOpenBell}
          aria-label="Notifications"
          sx={
            unreadCount > 0
              ? {
                  animation: "notif-bell-ring 2.4s ease-in-out infinite",
                  "@keyframes notif-bell-ring": {
                    "0%, 92%, 100%": { transform: "rotate(0deg)" },
                    "94%": { transform: "rotate(13deg)" },
                    "96%": { transform: "rotate(-11deg)" },
                    "98%": { transform: "rotate(6deg)" },
                  },
                }
              : undefined
          }
        >
          <Badge badgeContent={unreadCount} color="error" max={99}>
            {unreadCount > 0 ? <NotificationsActiveOutlinedIcon /> : <NotificationsOutlinedIcon />}
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { width: 380, maxWidth: "90vw", mt: 1 } } }}
      >
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", p: 1.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Notifications
          </Typography>
          {unreadCount > 0 && (
            <Button size="small" startIcon={<DoneAllIcon fontSize="small" />} onClick={handleMarkAllRead}>
              Mark all read
            </Button>
          )}
        </Stack>
        <Divider />
        <Box sx={{ maxHeight: 420, overflowY: "auto" }}>
          {notifications.length === 0 ? (
            <Box sx={{ p: 3, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                No notifications yet.
              </Typography>
            </Box>
          ) : (
            notifications.map((n, i) => (
              <Fade in key={n.id} timeout={200 + Math.min(i, 10) * 40}>
                <div>
                  <NotificationItem notification={n} read={isReadByMe(n)} onOpen={handleOpenNotification} />
                  <Divider />
                </div>
              </Fade>
            ))
          )}
        </Box>
      </Popover>
    </>
  );
}
