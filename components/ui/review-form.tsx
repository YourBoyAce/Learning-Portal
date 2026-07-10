"use client";

import { type ChangeEvent } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ReviewFormProps {
  reviewRating: number;
  reviewText: string;
  error?: string;
  saved: boolean;
  submitting: boolean;
  onRatingChange: (rating: number) => void;
  onReviewTextChange: (value: string) => void;
  onSubmit: () => void;
  className?: string;
}

export default function ReviewForm({
  reviewRating,
  reviewText,
  error,
  saved,
  submitting,
  onRatingChange,
  onReviewTextChange,
  onSubmit,
  className,
}: ReviewFormProps) {
  return (
    <div
      className={cn(
        "w-full rounded-3xl border border-amber-100 bg-amber-50/70 p-5 sm:p-6 shadow-sm",
        className,
      )}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <Star size={18} />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-800">Leave a quick review</h3>
          <p className="text-xs text-gray-600">Rate your experience and share any feedback with us.</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-3 mb-4">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onRatingChange(star)}
            className="transition-transform hover:scale-110 p-1 rounded"
            aria-label={`Rate ${star} out of 5`}
          >
            <Star
              size={24}
              className={
                star <= reviewRating ? "text-amber-500 fill-amber-500" : "text-gray-300"
              }
              strokeWidth={1.6}
            />
          </button>
        ))}
      </div>

      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
        Your experience
      </label>
      <textarea
        value={reviewText}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onReviewTextChange(event.target.value)}
        rows={5}
        placeholder="Share what you liked, what felt difficult, or any suggestions you have..."
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 min-h-[120px]"
      />

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {saved && (
        <p className="mt-2 text-sm font-medium text-emerald-600">
          Thank you! Your review has been saved.
        </p>
      )}

      <Button
        onClick={onSubmit}
        disabled={submitting || !reviewText.trim() || reviewRating < 1}
        className="mt-4 w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-600 hover:bg-slate-700 text-white font-bold text-sm transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? "Saving review..." : saved ? "Review Saved" : "Save Review"}
      </Button>
    </div>
  );
}
