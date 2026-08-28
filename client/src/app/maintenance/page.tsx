"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export const dynamic = "force-dynamic";

const RETRY_INTERVAL_MS = 30_000; // 30 seconds

export default function MaintenancePage() {
  const [elapsed, setElapsed] = useState(0);
  const [autoRetry, setAutoRetry] = useState(true);
  const [checking, setChecking] = useState(false);
  const [nextCheck, setNextCheck] = useState(RETRY_INTERVAL_MS / 1000);
  const [lastCheckResult, setLastCheckResult] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Elapsed timer
  useEffect(() => {
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Health check function
  const checkHealth = useCallback(async () => {
    setChecking(true);
    setLastCheckResult(null);
    try {
      // Cancel any in-flight request
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      const res = await fetch("/api/../health", {
        signal: abortRef.current.signal,
        cache: "no-store",
      });

      if (res.ok) {
        // Platform is back — redirect to home
        setLastCheckResult("success");
        window.location.href = "/";
        return;
      }

      // Still in maintenance (503 or other error)
      setLastCheckResult("maintenance");
    } catch {
      // Network error or fetch failed — still in maintenance
      setLastCheckResult("maintenance");
    } finally {
      setChecking(false);
      setNextCheck(RETRY_INTERVAL_MS / 1000);
    }
  }, []);

  // Countdown to next auto-retry
  useEffect(() => {
    if (!autoRetry) return;

    const countdown = setInterval(() => {
      setNextCheck((prev) => {
        if (prev <= 1) {
          checkHealth();
          return RETRY_INTERVAL_MS / 1000;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdown);
  }, [autoRetry, checkHealth]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const handleManualRetry = () => {
    setNextCheck(RETRY_INTERVAL_MS / 1000);
    checkHealth();
  };

  const toggleAutoRetry = () => {
    setAutoRetry((prev) => !prev);
    if (!autoRetry) {
      // Starting auto-retry — reset countdown
      setNextCheck(RETRY_INTERVAL_MS / 1000);
    }
  };

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <div className="min-h-screen bg-surface-container-lowest flex items-center justify-center px-margin-mobile">
      <div className="text-center max-w-lg">
        {/* Icon */}
        <div className="w-24 h-24 mx-auto bg-primary-container rounded-full flex items-center justify-center mb-8">
          <span
            className="material-symbols-outlined text-[48px] text-primary"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            construction
          </span>
        </div>

        {/* Heading */}
        <h1 className="font-headline-lg text-headline-lg text-primary mb-3">
          We&apos;ll be back soon
        </h1>

        {/* Description */}
        <p className="text-on-surface-variant font-body-lg mb-2 max-w-md mx-auto">
          Krishi Market is currently undergoing scheduled maintenance to serve
          you better. We&apos;re working hard to get back online.
        </p>
        <p className="text-on-surface-variant font-body-md mb-10">
          Please check back in a few minutes.
        </p>

        {/* Status card */}
        <div className="bg-surface-container-low rounded-2xl border border-outline-variant p-6 mb-8 inline-block">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
            <span className="font-label-md text-on-surface-variant">
              Maintenance in progress
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-left">
            <div>
              <p className="font-label-sm text-on-surface-variant uppercase tracking-wider">
                Elapsed
              </p>
              <p className="font-body-md text-on-surface font-medium font-mono">
                {minutes > 0 ? `${minutes}m ` : ""}
                {seconds.toString().padStart(2, "0")}s
              </p>
            </div>
            <div>
              <p className="font-label-sm text-on-surface-variant uppercase tracking-wider">
                {autoRetry ? "Next check in" : "Auto-retry"}
              </p>
              <p className="font-body-md text-on-surface font-medium font-mono">
                {autoRetry
                  ? checking
                    ? "Checking..."
                    : `${nextCheck}s`
                  : "Paused"}
              </p>
            </div>
          </div>
          {lastCheckResult === "maintenance" && (
            <div className="mt-3 pt-3 border-t border-outline-variant">
              <p className="text-label-sm text-on-surface-variant">
                Still under maintenance. Retrying every {RETRY_INTERVAL_MS / 1000}s...
              </p>
            </div>
          )}
        </div>

        {/* Retry controls */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
          <button
            onClick={handleManualRetry}
            disabled={checking}
            className="px-8 py-3 bg-primary text-on-primary font-label-md rounded-xl hover:opacity-90 active:scale-[0.98] transition-all inline-flex items-center gap-2 disabled:opacity-50"
          >
            {checking ? (
              <>
                <span className="animate-spin material-symbols-outlined text-lg">progress_activity</span>
                Checking...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">refresh</span>
                Check Now
              </>
            )}
          </button>
          <button
            onClick={toggleAutoRetry}
            className={`px-6 py-3 font-label-md rounded-xl border-2 transition-all inline-flex items-center gap-2 ${
              autoRetry
                ? "border-primary text-primary hover:bg-primary/5"
                : "border-outline-variant text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            <span className="material-symbols-outlined text-lg">
              {autoRetry ? "pause" : "play_arrow"}
            </span>
            {autoRetry ? "Pause Auto-Retry" : "Resume Auto-Retry"}
          </button>
        </div>

        {/* Contact info */}
        <div className="bg-surface-container-low rounded-xl border border-outline-variant p-5">
          <p className="font-label-md text-on-surface-variant mb-2">
            Need urgent help?
          </p>
          <a
            href="mailto:support@krishimarket.in"
            className="text-primary font-label-md hover:underline inline-flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">mail</span>
            support@krishimarket.in
          </a>
        </div>
      </div>
    </div>
  );
}
