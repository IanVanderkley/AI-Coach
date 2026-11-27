import { AlertCircle, Award, CheckCircle2, Info, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./feedback-notice.module.css";

export type FeedbackTone = "info" | "success" | "warning" | "error" | "loading" | "reward" | "protection";

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: AlertCircle,
  loading: Loader2,
  reward: Award,
  protection: ShieldCheck,
};

export function FeedbackNotice({
  tone = "info",
  title,
  description,
  action,
  metric,
  detail,
}: {
  tone?: FeedbackTone;
  title: string;
  description?: string;
  action?: ReactNode;
  metric?: { value: string; label: string };
  detail?: string;
}) {
  const Icon = icons[tone];
  return (
    <div className={`${styles.notice} ${styles[tone]} ${metric ? styles.withMetric : ""}`} data-feedback-tone={tone}>
      <span className={styles.iconTile}>
        <Icon className={styles.icon} size={21} aria-hidden="true" />
      </span>
      <div className={styles.content} role={tone === "error" ? "alert" : "status"}>
        <p className={styles.title}>{title}</p>
        {description && <p className={styles.description}>{description}</p>}
        {metric && (
          <div className={styles.metric}>
            <strong>{metric.value}</strong>
            <span>{metric.label}</span>
          </div>
        )}
        {detail && <p className={styles.detail}>{detail}</p>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
