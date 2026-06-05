"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Stream, type StreamPlayerApi } from "@cloudflare/stream-react";
// Navigating up from components -> [id] -> courses -> (main) -> app -> actions
import {
  saveUserPlaybackPosition,
  upsertUserProgress,
} from "../../../../actions/user-progress";

interface CourseVideoPlayerProps {
  userId: string;
  courseId: string;
  moduleId: string;
  videoUrl: string;
  thumbnailUrl?: string | null;
  initialPositionSeconds?: number;
  progressAliasIds?: string[];
  autoPlay?: boolean;
  onCompleted?: () => void;
  onProgressPosition?: (positionSeconds: number) => void;
}

export default function CourseVideoPlayer({
  userId,
  courseId,
  moduleId,
  videoUrl,
  thumbnailUrl,
  initialPositionSeconds = 0,
  progressAliasIds = [],
  autoPlay = false,
  onCompleted,
  onProgressPosition,
}: CourseVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<StreamPlayerApi | undefined>(undefined);
  const lastSavedPositionRef = useRef(0);
  const lastSavedAtRef = useRef(0);
  const initialSeekAppliedRef = useRef(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startPosition = Math.max(0, Math.floor(initialPositionSeconds || 0));

  const isCloudflareIframe = useMemo(() => {
    return [
      "iframe.videodelivery.net",
      "watch.cloudflarestream.com",
      "cloudflarestream.com",
    ].some((token) => videoUrl.includes(token));
  }, [videoUrl]);

  const streamSource = useMemo(() => {
    if (!isCloudflareIframe) return null;
    try {
      const url = new URL(videoUrl);
      const segments = url.pathname.split("/").filter(Boolean);
      const iframeIndex = segments.findIndex((segment) => segment === "iframe");
      if (iframeIndex > 0) return segments[iframeIndex - 1];
      return segments[segments.length - 1] || null;
    } catch {
      return videoUrl.split("?")[0].split("/").filter(Boolean).pop() || null;
    }
  }, [isCloudflareIframe, videoUrl]);

  const getProgressPercent = (positionSeconds: number, durationSeconds: number) => {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;
    return Math.max(
      0,
      Math.min(99, Math.floor((positionSeconds / durationSeconds) * 100)),
    );
  };

  const savePlaybackPosition = async (
    positionSeconds: number,
    durationSeconds: number,
    force = false,
  ) => {
    if (!Number.isFinite(positionSeconds) || positionSeconds < 0 || isCompleted) {
      return;
    }

    const roundedPosition = Math.floor(positionSeconds);
    if (roundedPosition < 3) return;

    const now = Date.now();
    const movedEnough =
      Math.abs(roundedPosition - lastSavedPositionRef.current) >= 5;
    const waitedEnough = now - lastSavedAtRef.current >= 10000;

    onProgressPosition?.(roundedPosition);

    if (!force && (!movedEnough || !waitedEnough)) return;

    lastSavedPositionRef.current = roundedPosition;
    lastSavedAtRef.current = now;

    try {
      await saveUserPlaybackPosition(
        userId,
        courseId,
        moduleId,
        roundedPosition,
        getProgressPercent(roundedPosition, durationSeconds),
        progressAliasIds,
      );
    } catch (error) {
      console.error("Error saving playback position:", error);
    }
  };

  const updateProgress = async (completed: boolean) => {
    try {
      await upsertUserProgress(
        userId,
        courseId,
        moduleId,
        completed ? 100 : 0,
        completed,
        progressAliasIds,
        completed ? 0 : lastSavedPositionRef.current,
      );
    } catch (error) {
      console.error("Error saving video progress:", error);
      setErrorMessage("Unable to save progress right now. Please try again.");
    } finally {
      if (completed) {
        setIsCompleted(true);
        onCompleted?.();
      }
    }
  };

  const handleEnded = async () => {
    if (isCompleted || isCloudflareIframe) return;
    setIsCompleted(true);
    onProgressPosition?.(0);
    await updateProgress(true);
  };

  useEffect(() => {
    setIsCompleted(false);
    setErrorMessage(null);
    lastSavedPositionRef.current = startPosition;
    lastSavedAtRef.current = 0;
    initialSeekAppliedRef.current = startPosition <= 0;
  }, [moduleId, videoUrl, startPosition]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || isCloudflareIframe || startPosition <= 0) return;

    const applyInitialPosition = () => {
      if (
        !initialSeekAppliedRef.current &&
        Number.isFinite(video.duration) &&
        startPosition < video.duration - 2
      ) {
        video.currentTime = startPosition;
        initialSeekAppliedRef.current = true;
      }
    };

    if (video.readyState >= 1) {
      applyInitialPosition();
    }

    video.addEventListener("loadedmetadata", applyInitialPosition);
    return () => video.removeEventListener("loadedmetadata", applyInitialPosition);
  }, [isCloudflareIframe, moduleId, startPosition, videoUrl]);

  useEffect(() => {
    const player = streamRef.current;
    if (
      !player ||
      !isCloudflareIframe ||
      startPosition <= 0 ||
      initialSeekAppliedRef.current
    ) {
      return;
    }

    const seekToStartPosition = () => {
      if (
        !initialSeekAppliedRef.current &&
        Number.isFinite(player.duration) &&
        startPosition < player.duration - 2
      ) {
        player.currentTime = startPosition;
        initialSeekAppliedRef.current = true;
      }
    };

    seekToStartPosition();
    player.addEventListener("loadedmetadata", seekToStartPosition);
    player.addEventListener("canplay", seekToStartPosition);

    return () => {
      player.removeEventListener("loadedmetadata", seekToStartPosition);
      player.removeEventListener("canplay", seekToStartPosition);
    };
  }, [isCloudflareIframe, moduleId, startPosition, videoUrl]);

  useEffect(() => {
    if (!isCloudflareIframe) return;

    const iframeOrigin = (() => {
      try {
        return new URL(videoUrl).origin;
      } catch {
        return null;
      }
    })();

    const handleMessage = async (event: MessageEvent) => {
      if (!iframeOrigin || event.origin !== iframeOrigin) return;
      const data = typeof event.data === "string"
        ? (() => {
            try {
              return JSON.parse(event.data);
            } catch {
              return null;
            }
          })()
        : event.data;

      if (!data || typeof data !== "object") return;

      const rawEventType = (data as any).type || (data as any).event || (data as any).eventName || (data as any)?.detail?.type;
      const eventType = typeof rawEventType === "string" ? rawEventType.toLowerCase() : null;
      if (eventType && (eventType.includes("ended") || eventType.includes("complete") || eventType.includes("finished"))) {
        if (!isCompleted) {
          setIsCompleted(true);
          onProgressPosition?.(0);
          await updateProgress(true);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isCloudflareIframe, videoUrl, isCompleted]);

  const handleNativeTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    void savePlaybackPosition(video.currentTime, video.duration);
  };

  const handleNativePause = () => {
    const video = videoRef.current;
    if (!video || video.ended) return;
    void savePlaybackPosition(video.currentTime, video.duration, true);
  };

  const handleStreamTimeUpdate = () => {
    const player = streamRef.current;
    if (!player) return;
    void savePlaybackPosition(player.currentTime, player.duration);
  };

  const handleStreamPause = () => {
    const player = streamRef.current;
    if (!player || player.ended) return;
    void savePlaybackPosition(player.currentTime, player.duration, true);
  };

  const handleStreamReadyToSeek = () => {
    const player = streamRef.current;
    if (
      !player ||
      initialSeekAppliedRef.current ||
      startPosition <= 0 ||
      !Number.isFinite(player.duration) ||
      startPosition >= player.duration - 2
    ) {
      return;
    }

    player.currentTime = startPosition;
    initialSeekAppliedRef.current = true;
  };

  const handleStreamEnded = async () => {
    if (isCompleted) return;
    setIsCompleted(true);
    onProgressPosition?.(0);
    await updateProgress(true);
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="relative rounded-[1.5rem] overflow-hidden shadow-xl bg-black">
        {isCloudflareIframe && streamSource ? (
          <div className="aspect-video bg-surface-video">
            <Stream
              streamRef={streamRef}
              src={streamSource}
              title="Course video player"
              controls
              autoplay={autoPlay}
              poster={thumbnailUrl || undefined}
              startTime={startPosition > 0 ? startPosition : undefined}
              width="100%"
              height="100%"
              responsive={false}
              className="w-full h-full"
              onLoadedMetaData={handleStreamReadyToSeek}
              onCanPlay={handleStreamReadyToSeek}
              onTimeUpdate={handleStreamTimeUpdate}
              onPause={handleStreamPause}
              onEnded={() => {
                void handleStreamEnded();
              }}
            />
          </div>
        ) : (
          <video
            ref={videoRef}
            src={videoUrl}
            poster={thumbnailUrl || undefined}
            controls
            autoPlay={autoPlay}
            onTimeUpdate={handleNativeTimeUpdate}
            onPause={handleNativePause}
            onEnded={handleEnded}
            className="w-full h-auto bg-black"
          />
        )}
      </div>

      {errorMessage && (
        <div className="mt-3 rounded-2xl bg-red-50 border border-red-100 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
