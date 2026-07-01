import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import {
  useGetEvent,
  useGetCurrentEventQr,
  useGetOrgSettings,
  getGetEventQueryKey,
  getGetCurrentEventQrQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock } from "@/components/page-states";
import { useMe } from "@/lib/me";
import LoginPage from "@/pages/login";
import { ArrowLeft } from "lucide-react";
import { Pill } from "@/components/badges";

export default function EventQrPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const me = useMe();
  if (me.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingBlock />
      </div>
    );
  }
  if (!me.isAuthenticated) return <LoginPage />;
  if (!me.isLeader) {
    return <ErrorBlock title="Leadership only" />;
  }
  return <QrDisplay id={id} />;
}

function QrDisplay({ id }: { id: number }) {
  const { data: org } = useGetOrgSettings();
  const event = useGetEvent(id, {
    query: {
      queryKey: getGetEventQueryKey(id),
      enabled: Number.isFinite(id),
    },
  });
  const qr = useGetCurrentEventQr(id, {
    query: {
      queryKey: getGetCurrentEventQrQueryKey(id),
      enabled: Number.isFinite(id) && (event.data?.qrActive ?? false),
      refetchInterval: 10_000,
      refetchIntervalInBackground: true,
    },
  });

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const expiresAt = qr.data ? new Date(qr.data.expiresAt).getTime() : 0;
  const secondsLeft = Math.max(0, Math.floor((expiresAt - now) / 1000));

  return (
    <div className="min-h-screen w-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6 sm:p-10">
        <div className="flex items-center justify-between">
          <Button
            asChild
            variant="ghost"
            className="text-white hover:bg-white/10"
          >
            <Link href={`/events/${id}`}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to event
            </Link>
          </Button>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/60">
              {org?.chapterName ?? "Chapter"}
            </p>
            <p className="font-serif text-sm text-white/80">
              C100 · Live check-in
            </p>
          </div>
        </div>

        {event.isLoading ? (
          <LoadingBlock label="Loading event" />
        ) : !event.data ? (
          <ErrorBlock />
        ) : (
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.22em] text-[hsl(var(--secondary))]">
                Now checking in
              </p>
              <h1 className="font-serif text-4xl font-bold leading-tight sm:text-5xl">
                {event.data.title}
              </h1>
              <p className="text-white/70">
                {event.data.location} · {event.data.startTime} –{" "}
                {event.data.endTime}
              </p>
              {!event.data.qrActive ? (
                <Pill tone="warning">Check-in is not active</Pill>
              ) : null}
              <div className="space-y-1 pt-4">
                <p className="text-sm text-white/60">Current code</p>
                {qr.data ? (
                  <p
                    className="font-mono text-4xl tracking-[0.4em] text-[hsl(var(--secondary))]"
                    data-testid="text-token"
                  >
                    {qr.data.token.toUpperCase()}
                  </p>
                ) : (
                  <p className="text-white/50">—</p>
                )}
              </div>
              {qr.data ? (
                <div className="pt-2">
                  <p className="text-xs uppercase tracking-wide text-white/60">
                    New code in
                  </p>
                  <p className="font-serif text-2xl font-semibold">
                    {secondsLeft}s
                  </p>
                </div>
              ) : null}
              <p className="pt-6 text-xs text-white/60">
                Members open the event in their dashboard and enter this code,
                or scan the QR. Codes rotate every minute.
              </p>
            </div>
            <div className="flex justify-center">
              <div className="rounded-2xl bg-white p-6 shadow-xl">
                {qr.data ? (
                  <QRCodeSVG
                    value={`${window.location.origin}/events/${id}?code=${encodeURIComponent(qr.data.token)}`}
                    size={320}
                    level="M"
                    includeMargin={false}
                    fgColor="hsl(221, 100%, 31%)"
                    bgColor="#FFFFFF"
                  />
                ) : (
                  <div className="flex h-[320px] w-[320px] items-center justify-center text-[hsl(var(--primary))]">
                    <LoadingBlock label="Generating code" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
