import type { AuditLog } from '../api/client';

interface Props {
  logs: AuditLog[];
  loading: boolean;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  created:   { label: 'Created',   color: '#5b7cf6' },
  edited:    { label: 'Edited',    color: '#8b91a8' },
  submitted: { label: 'Submitted', color: '#fbbf24' },
  approved:  { label: 'Approved',  color: '#60a5fa' },
  rejected:  { label: 'Rejected',  color: '#f87171' },
  reopened:  { label: 'Reopened',  color: '#a78bfa' },
  published: { label: 'Published', color: '#34d399' },
  archived:  { label: 'Archived',  color: '#575d76' },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DocumentHistory({ logs, loading }: Props) {
  if (loading) {
    return (
      <div className="loading-center">
        <div className="spinner" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '24px' }}>
        <p>No history yet</p>
      </div>
    );
  }

  return (
    <div className="history-list">
      {logs.map((log) => {
        const meta = ACTION_LABELS[log.action] ?? { label: log.action, color: '#8b91a8' };
        const transitionText =
          log.fromStatus && log.toStatus
            ? `${log.fromStatus} → ${log.toStatus}`
            : null;

        return (
          <div key={log.id} className="history-item">
            <div
              className="history-dot"
              style={{ background: meta.color }}
            />
            <div className="history-content">
              <div className="history-action">
                <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>
                {' '}by {log.actor?.name ?? 'Unknown'}
                {transitionText && (
                  <span className="text-muted" style={{ marginLeft: 8 }}>
                    ({transitionText})
                  </span>
                )}
              </div>
              <div className="history-meta">{formatDate(log.timestamp)}</div>
              {log.comment && (
                <div className="history-comment">"{log.comment}"</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
