// src/components/financials/statusIcons.js
//
// Icon per cluster-financial-status key (financialUtils' CLUSTER_STATUS),
// shared between RevenueProfitabilityPage (portfolio health legend) and
// ClusterFinancialsTable (status chips) so the same trend glyph always
// means the same thing everywhere it appears — a small, deliberately
// separate module so financialUtils.js itself stays a plain data/logic
// file with no MUI/React dependency.
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import TrendingFlatRoundedIcon from "@mui/icons-material/TrendingFlatRounded";
import TrendingDownRoundedIcon from "@mui/icons-material/TrendingDownRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";

export const STATUS_ICON = {
  healthy: TrendingUpRoundedIcon,
  thin: TrendingFlatRoundedIcon,
  loss: TrendingDownRoundedIcon,
  no_revenue: HelpOutlineRoundedIcon,
};
