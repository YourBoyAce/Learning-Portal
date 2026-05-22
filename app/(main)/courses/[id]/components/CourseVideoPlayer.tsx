"use client";

import { useEffect, useMemo, useRef, useState } from "react";
// Navigating up from components -> [id] -> courses -> (main) -> app -> actions
import { upsertUserProgress } from "../../../../actions/user-progress";

interface CourseVideoPlayerProps {
  userId: string;
  courseId: string;
  moduleId: string;
  videoUrl: string;
  onCompleted?: () => void;
}

export default function CourseVideoPlayer({
  userId,
  courseId,
  moduleId,
  videoUrl,
  onCompleted,
}: CourseVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isCloudflareIframe = useMemo(() => {
    return [
      "iframe.videodelivery.net",
      "watch.cloudflarestream.com",
      "cloudflarestream.com",
    ].some((token) => videoUrl.includes(token));
  }, [videoUrl]);

  const updateProgress = async (completed: boolean) => {
    try {
      await upsertUserProgress(userId, courseId, moduleId, completed ? 100 : 0, completed);
      if (completed) {
        setIsCompleted(true);
        onCompleted?.();
      }
    } catch (error) {
      console.error("Error saving video progress:", error);
      setErrorMessage("Unable to save progress right now. Please try again.");
    }
  };

  const handleEnded = async () => {
    if (isCompleted || isCloudflareIframe) return;
    setIsCompleted(true);
    await updateProgress(true);
  };

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
          await updateProgress(true);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isCloudflareIframe, videoUrl, isCompleted]);

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="relative rounded-[1.5rem] overflow-hidden shadow-xl bg-black">
        {isCloudflareIframe ? (
          <div className="aspect-video bg-[#111827]">
            <iframe
              src={videoUrl}
              title="Course video player"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
            />
          </div>
        ) : (
          <video
            ref={videoRef}
            src={videoUrl}
            controls
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