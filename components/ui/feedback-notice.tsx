import { AlertCircle, CheckCircle2, Info, Loader2, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./feedback-notice.module.css";

export type FeedbackTone = "info" | "success" | "warning" | "error" | "loading";

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: AlertCircle,
  loading: Loader2,
};

export function FeedbackNotice({
  tone = "info",
  title,
  description,
  action,
}: {
  tone?: FeedbackTone;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const Icon = icons[tone];
  return (
    <div className={`${styles.notice} ${styles[tone]}`}>
      <Icon className={styles.icon} size={21} aria-hidden="true" />
      <div className={styles.content} role={tone === "error" ? "alert" : "status"}>
        <p className={styles.title}>{title}</p>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
