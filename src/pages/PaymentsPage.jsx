// src/pages/PaymentsPage.jsx
//
// Placeholder — scaffolding for the nav slot until a payments API exists.
import { Box, Card, CardContent, Typography } from "@mui/material";

export default function PaymentsPage() {
  return (
    <Box className="page">
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            Payments
          </Typography>
          <Typography color="text.secondary">
            Coming soon — this section will surface mukkadam payment data once the payments API is available.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
