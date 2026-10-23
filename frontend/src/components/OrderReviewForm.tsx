import { useState } from "react";
import { ApiError, post } from "../lib/api";
import type { Review } from "../lib/types";
import { Alert, Button, Field } from "./ui";

export function OrderReviewForm({
  orderId,
  onSubmitted,
}: {
  orderId: string;
  onSubmitted: (review: Review) => void;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = await post<{ review: Review }>(`/api/orders/${orderId}/review`, { rating, comment });
      onSubmitted(body.review);
    } catch (issue) {
      setError(issue instanceof ApiError ? issue.message : "Ulasan gagal dikirim.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" noValidate>
      <h2 className="font-semibold text-ink">Beri ulasan</h2>
      <p className="text-sm text-muted">Satu ulasan per pesanan. Ulasan tampil sebagai ulasan demo, bukan testimoni terverifikasi.</p>
      <Field id="review-rating" label="Rating">
        <select
          id="review-rating"
          value={rating}
          onChange={(event) => setRating(Number(event.target.value))}
          className="min-h-12 w-full rounded-lg border border-line bg-white px-3 text-base text-ink"
        >
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {value} dari 5
            </option>
          ))}
        </select>
      </Field>
      <Field id="review-comment" label="Komentar" hint="10 sampai 1000 karakter.">
        <textarea
          id="review-comment"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          minLength={10}
          maxLength={1000}
          rows={4}
          required
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-base text-ink"
        />
      </Field>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Button type="submit" disabled={busy || comment.trim().length < 10}>
        {busy ? "Mengirim..." : "Kirim ulasan"}
      </Button>
    </form>
  );
}
