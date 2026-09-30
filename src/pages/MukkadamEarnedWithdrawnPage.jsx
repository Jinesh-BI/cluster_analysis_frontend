// src/pages/MukkadamEarnedWithdrawnPage.jsx
//
// Kept as its own page (not a section on RevenueProfitabilityPage, per
// request) since it answers a distinct question — labor payables owed to
// mukkadams — rather than cluster-level P&L. MukkadamEarnedWithdrawnSection
// already carries its own heading/search/KPIs/table, so this is just the
// page-level wrapper for routing/padding consistency with other pages.
import { Box } from "@mui/material";
import MukkadamEarnedWithdrawnSection from "../components/financials/MukkadamEarnedWithdrawnSection";

export default function MukkadamEarnedWithdrawnPage() {
  return (
    <Box className="page">
      <MukkadamEarnedWithdrawnSection />
    </Box>
  );
}
