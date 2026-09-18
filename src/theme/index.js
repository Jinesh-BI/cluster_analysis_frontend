// src/theme/index.js
//
// App-wide MUI theme. Palette values are pulled from the existing plain-CSS
// tokens in styles.css (so MUI components read as native to this app rather
// than generic MUI blue) plus the teal-green MukkadamJobsBoard already used
// locally before this theme existed — kept as its own `secondary` slot
// rather than merged into `primary`, since MukkadamJobsBoard's DataGrid has
// that exact hex hardcoded in a few places and merging would risk a diff.
import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    primary: { main: "#2f6b4f", dark: "#204a37" },
    secondary: { main: "#0f6e56", dark: "#0a4d3c", contrastText: "#ffffff" },
    success: { main: "#3f8f5f" },
    warning: { main: "#c98a3f" },
    error: { main: "#b5502f" },
    info: { main: "#4a7fa3" },
    background: { default: "#f6f7f4", paper: "#ffffff" },
    text: { primary: "#1f2a24", secondary: "#6b7570" },
    divider: "#e2e5df",
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
    },
    MuiCard: {
      styleOverrides: {
        root: { boxShadow: "0 1px 3px rgba(31, 42, 36, 0.08)" },
      },
    },
    MuiPaper: {
      styleOverrides: {
        elevation1: { boxShadow: "0 1px 3px rgba(31, 42, 36, 0.08)" },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#ffffff",
          color: "#1f2a24",
          borderBottom: "1px solid #e2e5df",
        },
      },
      defaultProps: { elevation: 0 },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: "#ffffff",
          borderRight: "1px solid #e2e5df",
        },
      },
    },
  },
});

export default theme;
