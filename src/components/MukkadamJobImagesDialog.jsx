// src/components/MukkadamJobImagesDialog.jsx
//
// Full-detail photo gallery for a mukkadam job row — crossfading main
// viewer, keyboard-navigable, with a thumbnail rail and a per-photo detail
// panel (phase, captured time, map link). Adapted from the (broken,
// untracked) daily-allocation feature's JobImagesDialog design, but wired
// to the real /ops/mukkadams/jobs/ response shape: photos only carry an
// opaque `image_key`, so each one has to be presigned into a viewable URL
// on demand — see presignImage() below.

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Fade,
  IconButton,
  Skeleton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import HelpOutlineIcon from "@mui/icons-material/HelpOutlineOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import PhotoLibraryOutlinedIcon from "@mui/icons-material/PhotoLibraryOutlined";

const PRESIGN_TOKEN = import.meta.env.VITE_TENDER_PRESIGN_TOKEN;

const dtf = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});
function formatDateTime(iso) {
  return iso ? dtf.format(new Date(iso)) : "—";
}

export function getValidImages(row) {
  return (row?.images ?? []).filter((image) => Boolean(image?.image_key));
}

async function presignImage(key, signal) {
  const res = await fetch(
    `https://demand.bharatintelligence.ai/chat/presign_obj_api/?key=${encodeURIComponent(key)}`,
    { headers: { Authorization: `Token ${PRESIGN_TOKEN}` }, signal },
  );
  if (!res.ok) throw new Error(`Could not load this photo (${res.status})`);
  const body = await res.json();
  return body.url;
}

const PHASE_META = {
  start: { label: "Job start", color: "primary", icon: <PlayArrowRoundedIcon fontSize="small" /> },
  end: { label: "Job end", color: "info", icon: <CheckCircleOutlineIcon fontSize="small" /> },
  unknown: { label: "Field photo", color: "default", icon: <HelpOutlineIcon fontSize="small" /> },
};
function phaseMeta(phase) {
  return PHASE_META[phase || "unknown"];
}

export function MukkadamJobImagesDialog({ open, row, onClose }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const [resolvedImages, setResolvedImages] = useState([]);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Resolve this row's photo keys into real URLs whenever the dialog is
  // opened (or reopened on a different row) — never eagerly for rows that
  // are only visible in the table.
  useEffect(() => {
    if (!open || !row) return undefined;
    let ignore = false;
    const controller = new AbortController();
    setResolving(true);
    setResolveError(null);
    setResolvedImages([]);
    setActiveIndex(0);
    setImageLoaded(false);

    Promise.all(
      getValidImages(row).map((img) =>
        presignImage(img.image_key, controller.signal).then((url) => ({ ...img, image_url: url })),
      ),
    )
      .then((resolved) => {
        if (!ignore) setResolvedImages(resolved);
      })
      .catch((err) => {
        if (!ignore && err.name !== "AbortError") setResolveError(err.message);
      })
      .finally(() => {
        if (!ignore) setResolving(false);
      });

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [open, row?.allocation_id]);

  useEffect(() => {
    setImageLoaded(false);
  }, [activeIndex]);

  useEffect(() => {
    if (!open || resolvedImages.length < 2) return undefined;

    function handleKeyDown(event) {
      if (event.key === "ArrowLeft") {
        setActiveIndex((index) => Math.max(0, index - 1));
      }
      if (event.key === "ArrowRight") {
        setActiveIndex((index) => Math.min(resolvedImages.length - 1, index + 1));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, resolvedImages.length]);

  const active = resolvedImages[activeIndex];
  const meta = active ? phaseMeta(active.phase) : null;
  const hasLocation = active && active.latitude != null && active.longitude != null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={fullScreen}
      slotProps={{ paper: { sx: { borderRadius: fullScreen ? 0 : 3, overflow: "hidden" } } }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", pb: 1 }}>
        <Stack sx={{ minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.3 }} noWrap>
            {row?.mukkadam_name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {row?.activity_name} · {row?.plot_name}
          </Typography>
        </Stack>
        <IconButton onClick={onClose} size="small" sx={{ ml: 1, flexShrink: 0 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1, pb: 3 }}>
        {resolving ? (
          <Stack spacing={1.5} sx={{ alignItems: "center", py: 6, color: "text.secondary" }}>
            <CircularProgress size={28} />
            <Typography variant="body2">Loading photos…</Typography>
          </Stack>
        ) : resolveError ? (
          <Alert severity="error">{resolveError}</Alert>
        ) : resolvedImages.length === 0 ? (
          <Stack spacing={1.5} sx={{ alignItems: "center", py: 6, color: "text.secondary" }}>
            <PhotoLibraryOutlinedIcon sx={{ fontSize: 40 }} />
            <Typography variant="body2">No photos were captured for this job.</Typography>
          </Stack>
        ) : (
          <Stack spacing={2}>
            {/* Main viewer */}
            <Box
              sx={{
                position: "relative",
                borderRadius: 2,
                overflow: "hidden",
                bgcolor: "action.hover",
                aspectRatio: "4 / 3",
              }}
            >
              {!imageLoaded && (
                <Skeleton variant="rectangular" sx={{ position: "absolute", inset: 0 }} animation="wave" />
              )}

              <Fade in={imageLoaded} timeout={300} key={active?.image_url}>
                <Box
                  component="img"
                  src={active?.image_url}
                  alt={`${meta?.label || "Photo"} — image ${activeIndex + 1} of ${resolvedImages.length}`}
                  onLoad={() => setImageLoaded(true)}
                  sx={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transition: "transform 0.35s ease",
                    "&:hover": { transform: "scale(1.04)" },
                  }}
                />
              </Fade>

              {meta && (
                <Chip
                  size="small"
                  icon={meta.icon}
                  label={meta.label}
                  color={meta.color === "default" ? undefined : meta.color}
                  sx={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    fontWeight: 600,
                    bgcolor: meta.color === "default" ? "background.paper" : undefined,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                  }}
                />
              )}

              {resolvedImages.length > 1 && (
                <Chip
                  size="small"
                  label={`${activeIndex + 1} / ${resolvedImages.length}`}
                  sx={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    bgcolor: "rgba(0,0,0,0.55)",
                    color: "#fff",
                    fontWeight: 600,
                  }}
                />
              )}

              {resolvedImages.length > 1 && (
                <>
                  <IconButton
                    onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
                    disabled={activeIndex === 0}
                    sx={{
                      position: "absolute",
                      left: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      bgcolor: "rgba(255,255,255,0.85)",
                      transition: "transform 0.15s ease, background-color 0.15s ease",
                      "&:hover": { bgcolor: "#fff", transform: "translateY(-50%) scale(1.1)" },
                    }}
                  >
                    <ChevronLeftIcon />
                  </IconButton>

                  <IconButton
                    onClick={() => setActiveIndex((index) => Math.min(resolvedImages.length - 1, index + 1))}
                    disabled={activeIndex === resolvedImages.length - 1}
                    sx={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      bgcolor: "rgba(255,255,255,0.85)",
                      transition: "transform 0.15s ease, background-color 0.15s ease",
                      "&:hover": { bgcolor: "#fff", transform: "translateY(-50%) scale(1.1)" },
                    }}
                  >
                    <ChevronRightIcon />
                  </IconButton>
                </>
              )}
            </Box>

            {/* Detail panel */}
            <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", rowGap: 1 }}>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", color: "text.secondary" }}>
                <AccessTimeOutlinedIcon sx={{ fontSize: 17 }} />
                <Typography variant="body2">{formatDateTime(active?.time)}</Typography>
              </Stack>

              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", color: "text.secondary" }}>
                <PlaceOutlinedIcon sx={{ fontSize: 17 }} />
                {hasLocation ? (
                  <Typography
                    component="a"
                    href={`https://www.google.com/maps?q=${active.latitude},${active.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="body2"
                    sx={{ color: "primary.main", fontWeight: 500, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
                  >
                    View capture location
                  </Typography>
                ) : (
                  <Typography variant="body2">Location unavailable</Typography>
                )}
              </Stack>
            </Stack>

            {/* Thumbnail rail */}
            {resolvedImages.length > 1 && (
              <Stack direction="row" spacing={1} sx={{ overflowX: "auto", WebkitOverflowScrolling: "touch", pb: 0.5 }}>
                {resolvedImages.map((image, index) => {
                  const isActive = index === activeIndex;
                  return (
                    <Box
                      key={`${image.image_key}-${index}`}
                      component="button"
                      type="button"
                      onClick={() => setActiveIndex(index)}
                      sx={{
                        flexShrink: 0,
                        width: 56,
                        height: 56,
                        borderRadius: 2,
                        overflow: "hidden",
                        p: 0,
                        cursor: "pointer",
                        border: "2px solid",
                        borderColor: isActive ? "primary.main" : "transparent",
                        opacity: isActive ? 1 : 0.65,
                        transform: isActive ? "scale(1.05)" : "scale(1)",
                        transition: "transform 0.15s ease, opacity 0.15s ease, border-color 0.15s ease",
                        "&:hover": { opacity: 1 },
                      }}
                    >
                      <Box
                        component="img"
                        src={image.image_url}
                        alt=""
                        sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
