<script lang="ts">
  import type { PeerReview } from '$lib/types';
  import { app } from '$stores/app.svelte';
  import { formatDate } from '$lib/utils/format';
  import TalmidAvatar from './TalmidAvatar.svelte';
  import RankBadge from './RankBadge.svelte';

  interface Props {
    review: PeerReview;
  }

  let { review }: Props = $props();
  let reviewer = $derived(app.getTalmid(review.reviewerId));
</script>

<div
  class="space-y-3"
  style="
    background-color: var(--color-bg-secondary);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-lg);
    padding: 1rem;
  "
>
  <!-- Header: reviewer info + rating + date -->
  <div class="flex items-start justify-between gap-3">
    <div class="flex items-center gap-2.5">
      {#if reviewer}
        <TalmidAvatar shem={reviewer.shem} score={reviewer.contribution_score} isOnline={reviewer.isOnline} size="sm" />
        <div class="flex flex-col gap-0.5">
          <span class="text-sm font-semibold" style="color: var(--color-text-primary);">{reviewer.shem}</span>
          <RankBadge score={reviewer.contribution_score} size="sm" />
        </div>
      {:else}
        <span class="text-sm" style="color: var(--color-text-tertiary);">מבקר אנונימי</span>
      {/if}
    </div>
    <div class="flex flex-col items-end gap-1 flex-shrink-0">
      <!-- Stars — antiqued gold for filled, muted border for empty -->
      <div class="flex gap-0.5" aria-label="{review.rating} מתוך 5 כוכבים">
        {#each [1,2,3,4,5] as star}
          <span
            class="text-base"
            style="color: {star <= review.rating ? 'var(--color-accent-secondary)' : 'var(--color-border-primary)'};"
          >★</span>
        {/each}
      </div>
      <span class="text-[11px]" style="color: var(--color-text-tertiary);">{formatDate(review.createdAt)}</span>
    </div>
  </div>

  <!-- Comment body -->
  <p class="text-sm leading-relaxed" style="color: var(--color-text-primary);">{review.comments}</p>

  <!-- Suggestions -->
  {#if review.suggestions.length > 0}
    <div style="border-top: 1px solid var(--color-border-secondary); padding-top: 0.75rem;" class="space-y-1">
      <span class="text-[11px] font-semibold" style="color: var(--color-text-secondary);">הצעות לשיפור</span>
      <ul class="space-y-1 mt-1">
        {#each review.suggestions as suggestion}
          <li class="flex items-start gap-2 text-xs" style="color: var(--color-text-secondary);">
            <span class="flex-shrink-0 mt-0.5" style="color: var(--color-accent-primary);">▸</span>
            {suggestion}
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <!-- Footer: review status + tokens earned -->
  <div
    class="flex items-center justify-between pt-2"
    style="border-top: 1px solid var(--color-border-secondary);"
  >
    <span
      class="badge"
      style="
        background-color: {review.status === 'acknowledged' ? 'var(--color-status-success-light)' : 'var(--color-status-draft-light)'};
        color: {review.status === 'acknowledged' ? 'var(--color-status-success)' : 'var(--color-status-draft)'};
        border: 1px solid {review.status === 'acknowledged' ? 'rgba(30,111,80,0.3)' : 'rgba(138,127,114,0.3)'};
      "
    >
      {review.status === 'acknowledged' ? 'נלקח בחשבון' : review.status === 'submitted' ? 'הוגש' : 'ממתין'}
    </span>
    <span class="text-[11px] font-semibold" style="color: var(--color-accent-secondary); font-family: var(--font-mono);">+{review.tokensEarned} שכר</span>
  </div>
</div>
