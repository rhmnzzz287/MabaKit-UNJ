import { useState } from "react";
import { ApiError, post } from "../lib/api";
import type { Review } from "../lib/types";
import { Alert, Button, Card, Field, Select, Textarea } from "./ui";

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
    <Card className="space-y-4 p-6">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1">
          <h2 className="text-lg font-bold tracking-tight text-ink">Beri ulasan</h2>
          <p className="text-sm text-muted">
            Satu ulasan per pesanan. Ulasan tampil sebagai ulasan demo, bukan testimoni terverifikasi.
          </p>
        </div>
        <Field id="review-rating" label="Rating">
          <Select id="review-rating" value={rating} onChange={(event) => setRating(Number(event.target.value))}>
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {value} dari 5
              </option>
            ))}
          </Select>
        </Field>
        <Field id="review-comment" label="Komentar" hint="10 sampai 1000 karakter.">
          <Textarea
            id="review-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            minLength={10}
            maxLength={1000}
            rows={4}
            required
          />
        </Field>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Button type="submit" disabled={busy || comment.trim().length < 10}>
          {busy ? "Mengirim..." : "Kirim ulasan"}
        </Button>
      </form>
    </Card>
  );
}
