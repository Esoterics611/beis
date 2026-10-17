<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';

  interface Props {
    /** Serialized TipTap JSON (or null for an empty draft) */
    initialContent?: string | null;
    editable?: boolean;
    /** Debounced autosave callback; return false to signal failure */
    onSave?: (content: string, wordCount: number) => Promise<boolean>;
  }

  let { initialContent = null, editable = true, onSave }: Props = $props();

  let element: HTMLDivElement | undefined = $state();
  let editor: Editor | null = null;
  // bumped on every transaction so toolbar active-states re-derive
  let tick = $state(0);
  let saveState = $state<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
  let wordCount = $state(0);
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  const AUTOSAVE_MS = 1500;

  function countWords(text: string): number {
    const t = text.trim();
    return t ? t.split(/\s+/).length : 0;
  }

  function parseInitial(): object | string {
    if (!initialContent) return '';
    try { return JSON.parse(initialContent); } catch { return initialContent; }
  }

  async function flushSave() {
    if (!editor || !onSave) return;
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    saveState = 'saving';
    const content = JSON.stringify(editor.getJSON());
    const ok = await onSave(content, wordCount);
    saveState = ok ? 'saved' : 'error';
  }

  function scheduleSave() {
    if (!onSave) return;
    saveState = 'dirty';
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, AUTOSAVE_MS);
  }

  onMount(() => {
    editor = new Editor({
      element,
      editable,
      extensions: [StarterKit],
      content: parseInitial(),
      editorProps: {
        attributes: {
          dir: 'rtl',
          lang: 'he',
          class: 'chibbur-editor-content',
          'aria-label': 'טיוטת החיבור',
        },
      },
      onTransaction: () => { tick++; },
      onUpdate: ({ editor: ed }) => {
        wordCount = countWords(ed.state.doc.textContent);
        scheduleSave();
      },
    });
    wordCount = countWords(editor.state.doc.textContent);
  });

  // react to editable changes after mount (e.g. status flips on submit)
  $effect(() => {
    editor?.setEditable(editable);
  });

  onDestroy(() => {
    // flush a pending autosave before tearing down
    if (saveTimer && saveState === 'dirty') void flushSave();
    if (saveTimer) clearTimeout(saveTimer);
    editor?.destroy();
    editor = null;
  });

  interface ToolButton {
    label: string;
    title: string;
    isActive: () => boolean;
    run: () => void;
  }

  const tools: ToolButton[][] = [
    [
      { label: 'ב', title: 'מודגש', isActive: () => !!editor?.isActive('bold'), run: () => editor?.chain().focus().toggleBold().run() },
      { label: 'נ', title: 'נטוי', isActive: () => !!editor?.isActive('italic'), run: () => editor?.chain().focus().toggleItalic().run() },
      { label: 'ק', title: 'קו חוצה', isActive: () => !!editor?.isActive('strike'), run: () => editor?.chain().focus().toggleStrike().run() },
    ],
    [
      { label: 'כ״ב', title: 'כותרת ב', isActive: () => !!editor?.isActive('heading', { level: 2 }), run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
      { label: 'כ״ג', title: 'כותרת ג', isActive: () => !!editor?.isActive('heading', { level: 3 }), run: () => editor?.chain().focus().toggleHeading({ level: 3 }).run() },
      { label: '❝', title: 'ציטוט / מקור', isActive: () => !!editor?.isActive('blockquote'), run: () => editor?.chain().focus().toggleBlockquote().run() },
    ],
    [
      { label: '•', title: 'רשימה', isActive: () => !!editor?.isActive('bulletList'), run: () => editor?.chain().focus().toggleBulletList().run() },
      { label: '1.', title: 'רשימה ממוספרת', isActive: () => !!editor?.isActive('orderedList'), run: () => editor?.chain().focus().toggleOrderedList().run() },
    ],
    [
      { label: '↪', title: 'בטל', isActive: () => false, run: () => editor?.chain().focus().undo().run() },
      { label: '↩', title: 'בצע שוב', isActive: () => false, run: () => editor?.chain().focus().redo().run() },
    ],
  ];
</script>

<div class="rounded-xl border overflow-hidden" style="
  border-color: var(--color-border-primary);
  background-color: var(--color-bg-secondary);
" dir="rtl">
  {#if editable}
    <!-- Toolbar -->
    <div class="flex items-center gap-1 flex-wrap px-3 py-2 border-b" style="
      border-color: var(--color-border-secondary);
      background-color: var(--color-bg-tertiary);
    ">
      {#each tools as group, gi}
        {#if gi > 0}
          <div class="w-px h-5 mx-1" style="background-color: var(--color-border-primary);"></div>
        {/if}
        {#each group as t}
          {@const active = tick >= 0 && t.isActive()}
          <button
            type="button"
            title={t.title}
            aria-label={t.title}
            aria-pressed={active}
            onmousedown={(e) => e.preventDefault()}
            onclick={t.run}
            class="min-w-8 h-8 px-2 rounded-md text-sm font-semibold transition-colors"
            style="
              background-color: {active ? 'var(--color-accent-secondary-light)' : 'transparent'};
              color: {active ? 'var(--color-accent-secondary)' : 'var(--color-text-secondary)'};
            "
          >{t.label}</button>
        {/each}
      {/each}
    </div>
  {/if}

  <!-- Editor surface -->
  <div bind:this={element} class="chibbur-editor-surface"></div>

  {#if editable}
    <!-- Status bar -->
    <div class="flex items-center justify-between px-4 py-2 border-t text-[11px]" style="
      border-color: var(--color-border-secondary);
      color: var(--color-text-tertiary);
    ">
      <span>{wordCount.toLocaleString()} מילים</span>
      <span>
        {#if saveState === 'saving'}
          <span class="animate-spin inline-block">◎</span> שומר...
        {:else if saveState === 'saved'}
          ✓ נשמר
        {:else if saveState === 'dirty'}
          שינויים לא שמורים
        {:else if saveState === 'error'}
          <span style="color: var(--color-status-error, #b91c1c);">שגיאה בשמירה — ננסה שוב</span>
        {/if}
      </span>
    </div>
  {/if}
</div>

<style>
  .chibbur-editor-surface :global(.chibbur-editor-content) {
    min-height: 320px;
    padding: 1.5rem 1.75rem;
    outline: none;
    direction: rtl;
    font-family: var(--font-hebrew);
    font-size: 1.05rem;
    /* generous leading so nikud never clips */
    line-height: 2;
    color: var(--color-text-primary);
  }
  .chibbur-editor-surface :global(.chibbur-editor-content p) {
    margin: 0 0 0.75em;
  }
  .chibbur-editor-surface :global(.chibbur-editor-content h2) {
    font-size: 1.35rem;
    font-weight: 700;
    margin: 1.25em 0 0.5em;
  }
  .chibbur-editor-surface :global(.chibbur-editor-content h3) {
    font-size: 1.15rem;
    font-weight: 700;
    margin: 1em 0 0.4em;
  }
  .chibbur-editor-surface :global(.chibbur-editor-content blockquote) {
    border-inline-start: 3px solid var(--color-accent-secondary);
    background-color: var(--color-bg-tertiary);
    padding: 0.5rem 1rem;
    margin: 0.75em 0;
    border-radius: var(--radius-sm);
  }
  .chibbur-editor-surface :global(.chibbur-editor-content ul),
  .chibbur-editor-surface :global(.chibbur-editor-content ol) {
    padding-inline-start: 1.5rem;
    margin: 0.5em 0;
  }
  .chibbur-editor-surface :global(.chibbur-editor-content ul) { list-style: disc; }
  .chibbur-editor-surface :global(.chibbur-editor-content ol) { list-style: decimal; }
</style>
