export function LoadingState({ title = "Loading", rows = 3 }) {
  return (
    <div className="state-card" aria-live="polite">
      <div>
        <strong>{title}</strong>
        <p className="muted">Fetching the latest data.</p>
      </div>
      <div className="skeleton-stack" aria-hidden="true">
        {Array.from({ length: rows }).map((_, index) => (
          <span key={index} className="skeleton-line" />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({ title, message, action }) {
  return (
    <div className="state-card state-card--empty">
      <strong>{title}</strong>
      {message && <p className="muted">{message}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", message, onRetry }) {
  return (
    <div className="state-card state-card--error" role="alert">
      <div>
        <strong>{title}</strong>
        {message && <p className="error-text">{message}</p>}
      </div>
      {onRetry && (
        <button className="btn" type="button" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
