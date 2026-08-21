export function LoadingState({ label = "Loading private timeline…" }: { label?: string }) {
  return (
    <div className="state-card">
      <span className="spinner" />
      <p>{label}</p>
    </div>
  );
}
export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="state-card">
      <div className="empty-orbit">○</div>
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
export function ErrorState({ message }: { message: string }) {
  return (
    <div className="error-banner" role="alert">
      <strong>Couldn’t load this view.</strong>
      <span>{message}</span>
    </div>
  );
}
