import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--primary))]" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorBlock({
  title = "Something went wrong",
  message,
}: {
  title?: string;
  message?: string;
}) {
  return (
    <Card>
      <CardContent className="flex min-h-[160px] flex-col items-center justify-center gap-2 py-8 text-center">
        <p className="font-medium text-[hsl(var(--destructive))]">{title}</p>
        {message ? (
          <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function EmptyBlock({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex min-h-[180px] flex-col items-center justify-center gap-3 py-10 text-center">
        <p className="font-serif text-lg font-semibold">{title}</p>
        {description ? (
          <p className="max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
        {action}
      </CardContent>
    </Card>
  );
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-md" />
      ))}
    </div>
  );
}
