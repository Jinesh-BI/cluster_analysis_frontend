// src/layouts/AppLayout.jsx
//
// Persistent ERP-style shell: fixed top AppBar (branding + user + logout)
// and a left sidebar (module nav) that collapses to icon-only to free up
// width for the main content — state persisted in localStorage as a
// per-browser convenience, not app data. Renders as a pathless parent
// route in App.jsx, with page content coming through <Outlet/>. One
// ListItemButton per module today (Overview/Mukkadams/Payments/Managers) —
// deliberately not building a collapsible nested-tree nav yet since no
// module currently has more than one page; add nesting here once one does.
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AppBar,
  Box,
  Chip,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import Groups2OutlinedIcon from "@mui/icons-material/Groups2Outlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import SupervisorAccountOutlinedIcon from "@mui/icons-material/SupervisorAccountOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useAuth } from "../context/AuthContext";

const DRAWER_WIDTH = 240;
const COLLAPSED_WIDTH = 72;
const COLLAPSE_STORAGE_KEY = "sidebar_collapsed";

const NAV_ITEMS = [
  { label: "Overview", to: "/", icon: DashboardOutlinedIcon, exact: true },
  { label: "Mukkadams", to: "/mukkadams", icon: Groups2OutlinedIcon },
  // { label: "Payments", to: "/payments", icon: PaymentsOutlinedIcon },
];

export default function AppLayout() {
  const { user, isManagerTier, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_STORAGE_KEY, String(collapsed));
    } catch {
      // ignore — collapse state just won't persist across reloads
    }
  }, [collapsed]);

  const items = isManagerTier
    ? [...NAV_ITEMS, { label: "Managers", to: "/managers", icon: SupervisorAccountOutlinedIcon }]
    : NAV_ITEMS;

  const drawerWidth = collapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH;

  return (
    <Box sx={{ display: "flex" }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
            Grapes - Regional Manager
          </Typography>
          {user && (
            <>
              <Typography variant="body2" color="text.secondary">
                {user.username}
              </Typography>
              <Chip size="small" label={user.role?.replaceAll("_", " ")} variant="outlined" />
            </>
          )}
          <Tooltip title="Log out">
            <IconButton
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
              aria-label="Log out"
            >
              <LogoutOutlinedIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          whiteSpace: "nowrap",
          transition: (t) => t.transitions.create("width", { duration: t.transitions.duration.shortest }),
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: "border-box",
            overflowX: "hidden",
            transition: (t) => t.transitions.create("width", { duration: t.transitions.duration.shortest }),
          },
        }}
      >
        <Toolbar />

        <Box sx={{ display: "flex", justifyContent: collapsed ? "center" : "flex-end", px: 1, py: 0.5 }}>
          <Tooltip title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <IconButton size="small" onClick={() => setCollapsed((c) => !c)} aria-label="Toggle sidebar">
              {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>

        <List sx={{ px: 1 }}>
          {items.map(({ label, to, icon: Icon, exact }) => {
            const selected = exact ? location.pathname === to : location.pathname.startsWith(to);
            const button = (
              <ListItemButton
                key={to}
                selected={selected}
                onClick={() => navigate(to)}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  justifyContent: collapsed ? "center" : "flex-start",
                  px: collapsed ? 1.5 : 2,
                }}
              >
                <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36, justifyContent: "center" }}>
                  <Icon fontSize="small" color={selected ? "primary" : "inherit"} />
                </ListItemIcon>
                {!collapsed && <ListItemText primary={label} />}
              </ListItemButton>
            );
            return collapsed ? (
              <Tooltip key={to} title={label} placement="right">
                {button}
              </Tooltip>
            ) : (
              button
            );
          })}
        </List>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
        <Toolbar />
        <Box sx={{ py:0, px:0 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
