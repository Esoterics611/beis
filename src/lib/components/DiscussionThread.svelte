<script lang="ts">
  import type { Discussion } from '$lib/types';
  import { app } from '$stores/app.svelte';
  import { formatDate } from '$lib/utils/format';
  import TalmidAvatar from './TalmidAvatar.svelte';
  import RankBadge from './RankBadge.svelte';

  interface Props {
    masimaId: string;
  }

  let { masimaId }: Props = $props();
  let allComments = $derived(app.getMasimaDiscussions(masimaId));
  let roots = $derived(allComments.filter(d => !d.parentId));

  function replies(parentId: string): Discussion[] {
    return allComments.filter(d => d.parentId === parentId);
  }

  function getTalmid(id: string) {
    return app.getTalmid(id);
  }

  let newComment = $state('');
  let replyingTo = $state<string | null>(null);
  let replyText = $state('');

  function submitComment() {
    if (!newComment.trim() || !app.currentUser) return;
    app.addDiscussion({
      chibburId: masimaId,
      authorId: app.currentUser.id,
      content: newComment.trim(),
      tokensEarned: 5,
    });
    newComment = '';
  }

  function submitReply(parentId: string) {
    if (!replyText.trim() || !app.currentUser) return;
    app.addDiscussion({
      chibburId: masimaId,
      authorId: app.currentUser.id,
      parentId,
      content: replyText.trim(),
      tokensEarned: 3,
    });
    replyText = '';
    replyingTo = null;
  }
</script>

<div class="space-y-4">
  <h3 class="text-xs font-semibold" style="color: var(--color-text-secondary); letter-spacing: 0.05em;">
    דיון ({allComments.length})
  </h3>

  {#if roots.length === 0}
    <div class="text-center py-6 text-sm" style="color: var(--color-text-tertiary);">אין תגובות עדיין — היה הראשון!</div>
  {:else}
    {#each roots as comment}
      {@const author = getTalmid(comment.authorId)}
      <div class="space-y-2">
        <!-- Root comment -->
        <div class="flex gap-3">
          {#if author}
            <TalmidAvatar shem={author.shem} score={author.contribution_score} isOnline={author.isOnline} size="sm" />
          {/if}
          <div
            class="flex-1 space-y-1.5"
            style="
              background-color: var(--color-bg-secondary);
              border: 1px solid var(--color-border-secondary);
              border-radius: var(--radius-lg);
              padding: 0.75rem 1rem;
            "
          >
            <div class="flex items-center gap-2 flex-wrap">
              {#if author}
                <span class="text-sm font-semibold" style="color: var(--color-text-primary);">{author.shem}</span>
                <RankBadge score={author.contribution_score} size="sm" />
              {/if}
              <span class="text-[11px] mr-auto" style="color: var(--color-text-tertiary);">{formatDate(comment.createdAt)}</span>
            </div>
            <p class="text-sm leading-relaxed" style="color: var(--color-text-primary); line-height: 1.8;">{comment.content}</p>
            <div class="flex items-center justify-between pt-1">
              <button
                onclick={() => { replyingTo = replyingTo === comment.id ? null : comment.id; replyText = ''; }}
                class="text-xs transition-colors duration-150"
                style="color: var(--color-text-link); text-decoration: none; background: none; border: none; cursor: pointer;"
              >↩ השב</button>
              <span class="text-[11px] font-semibold" style="color: var(--color-accent-secondary); font-family: var(--font-mono);">+{comment.tokensEarned} שכר</span>
            </div>
          </div>
        </div>

        <!-- Replies (indented with vertical line) -->
        {#each replies(comment.id) as reply}
          {@const replyAuthor = getTalmid(reply.authorId)}
          <div class="flex gap-3" style="margin-right: 1.5rem; border-right: 2px solid var(--color-border-secondary); padding-right: 0.75rem;">
            {#if replyAuthor}
              <TalmidAvatar shem={replyAuthor.shem} score={replyAuthor.contribution_score} isOnline={replyAuthor.isOnline} size="sm" />
            {/if}
            <div
              class="flex-1 space-y-1.5"
              style="
                background-color: var(--color-bg-tertiary);
                border: 1px solid var(--color-border-secondary);
                border-radius: var(--radius-lg);
                padding: 0.75rem 1rem;
              "
            >
              <div class="flex items-center gap-2 flex-wrap">
                {#if replyAuthor}
                  <span class="text-sm font-semibold" style="color: var(--color-text-primary);">{replyAuthor.shem}</span>
                  <RankBadge score={replyAuthor.contribution_score} size="sm" />
                {/if}
                <span class="text-[11px] mr-auto" style="color: var(--color-text-tertiary);">{formatDate(reply.createdAt)}</span>
              </div>
              <p class="text-sm leading-relaxed" style="color: var(--color-text-primary); line-height: 1.8;">{reply.content}</p>
              <span class="text-[11px] font-semibold" style="color: var(--color-accent-secondary); font-family: var(--font-mono);">+{reply.tokensEarned} שכר</span>
            </div>
          </div>
        {/each}

        <!-- Inline reply input -->
        {#if replyingTo === comment.id}
          <div class="flex gap-3 pt-1" style="margin-right: 1.5rem;">
            {#if app.currentUser}
              <TalmidAvatar shem={app.currentUser.shem} score={app.currentUser.contribution_score} isOnline={app.currentUser.isOnline} size="sm" />
            {/if}
            <div class="flex-1">
              <textarea
                bind:value={replyText}
                rows="2"
                placeholder="תגובה... (+3 שכר)"
                dir="rtl"
                style="
                  width: 100%;
                  background-color: var(--color-bg-primary);
                  border: 1px solid var(--color-border-primary);
                  border-radius: var(--radius-md);
                  padding: 0.5rem 0.75rem;
                  font-size: 0.875rem;
                  color: var(--color-text-primary);
                  font-family: var(--font-hebrew);
                  resize: none;
                "
              ></textarea>
              <div class="flex gap-2 justify-end mt-1">
                <button
                  onclick={() => replyingTo = null}
                  class="px-3 py-1 text-xs transition-colors duration-150"
                  style="color: var(--color-text-tertiary); background: none; border: none; cursor: pointer; border-radius: var(--radius-sm);"
                >ביטול</button>
                <button
                  onclick={() => submitReply(comment.id)}
                  disabled={!replyText.trim()}
                  class="px-3 py-1 text-xs font-semibold transition-colors duration-150"
                  style="
                    background-color: var(--color-accent-primary);
                    color: var(--color-text-inverse);
                    border: none;
                    border-radius: var(--radius-sm);
                    cursor: pointer;
                    opacity: {replyText.trim() ? 1 : 0.4};
                  "
                >שלח</button>
              </div>
            </div>
          </div>
        {/if}
      </div>
    {/each}
  {/if}

  <!-- New root comment input -->
  <div
    class="flex gap-3 pt-3"
    style="border-top: 1px solid var(--color-border-primary);"
  >
    {#if app.currentUser}
      <TalmidAvatar shem={app.currentUser.shem} score={app.currentUser.contribution_score} isOnline={app.currentUser.isOnline} size="sm" />
    {/if}
    <div class="flex-1">
      <textarea
        bind:value={newComment}
        rows="2"
        placeholder="הוסף תגובה... (+5 שכר)"
        dir="rtl"
        style="
          width: 100%;
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border-primary);
          border-radius: var(--radius-md);
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: var(--color-text-primary);
          font-family: var(--font-hebrew);
          resize: none;
        "
      ></textarea>
      <div class="flex justify-end mt-1.5">
        <button
          onclick={submitComment}
          disabled={!newComment.trim()}
          class="px-3 py-1.5 text-xs font-semibold transition-colors duration-150"
          style="
            background-color: var(--color-accent-primary);
            color: var(--color-text-inverse);
            border: none;
            border-radius: var(--radius-sm);
            cursor: pointer;
            opacity: {newComment.trim() ? 1 : 0.4};
          "
        >שלח</button>
      </div>
    </div>
  </div>
</div>
