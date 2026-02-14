"use client";

import { createTheme } from "@mui/material/styles";

const commonBase = {
  typography: {
    fontFamily: '"Google Sans", "Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 500 },
    h2: { fontWeight: 500 },
    h3: { fontWeight: 500 },
    h4: { fontWeight: 500 },
    h5: { fontWeight: 500 },
    h6: { fontWeight: 500 },
    button: {
      textTransform: "none",
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 24,
          padding: "8px 24px",
        },
        contained: {
          boxShadow: "none",
        },
      },
    },
  },
} as const;

export const lightTheme = createTheme({
  ...commonBase,
  palette: {
    mode: "light",
    primary: {
      main: "#000000",
      light: "#333333",
      dark: "#000000",
    },
    background: {
      default: "#ffffff",
      paper: "#ffffff",
    },
    text: {
      primary: "#202124",
      secondary: "#5f6368",
    },
    divider: "#dadce0",
  },
  components: {
    ...commonBase.components,
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          border: "1px solid #dadce0",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#ffffff",
          color: "#202124",
          boxShadow: "none",
          borderBottom: "1px solid #dadce0",
        },
      },
    },
  },
});

export const darkTheme = createTheme({
  ...commonBase,
  palette: {
    mode: "dark",
    primary: {
      main: "#ffffff",
      light: "#ffffff",
      dark: "#f1f3f4",
    },
    background: {
      default: "#101114",
      paper: "#18191c",
    },
    text: {
      primary: "#e8eaed",
      secondary: "#9aa0a6",
    },
    divider: "#303134",
  },
  components: {
    ...commonBase.components,
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          border: "1px solid #303134",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#18191c",
          color: "#e8eaed",
          boxShadow: "none",
          borderBottom: "1px solid #303134",
        },
      },
    },
  },
});
