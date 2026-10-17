<script lang="ts">
  interface Props {
    size?: number;
  }
  let { size = 48 }: Props = $props();
</script>

<!--
  Institutional Crest — Beis
  Shield shape with Torah scroll, olive branches, and double border ring.
  Single-color SVG: uses currentColor for dark-on-light or light-on-dark contexts.
-->
<svg
  viewBox="0 0 64 72"
  width={size}
  height={size * (72 / 64)}
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  aria-label="Beis — סמל מוסדי"
  role="img"
>
  <!-- Outer shield border -->
  <path
    d="M32 2 L58 13 L58 40 C58 54 46 65 32 70 C18 65 6 54 6 40 L6 13 Z"
    stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"
  />
  <!-- Inner shield ring -->
  <path
    d="M32 6 L54 16 L54 40 C54 52 43 62 32 67 C21 62 10 52 10 40 L10 16 Z"
    stroke="currentColor" stroke-width="0.6" fill="none" stroke-linejoin="round"
  />

  <!-- Torah scroll — left etz chaim (handle) -->
  <line x1="17" y1="20" x2="17" y2="50" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="17" cy="34" r="3.5" stroke="currentColor" stroke-width="1.2" fill="none"/>
  <!-- Top and bottom caps of left handle -->
  <rect x="14.5" y="18" width="5" height="4" rx="2.5" stroke="currentColor" stroke-width="1" fill="none"/>
  <rect x="14.5" y="48" width="5" height="4" rx="2.5" stroke="currentColor" stroke-width="1" fill="none"/>

  <!-- Torah scroll — right etz chaim (handle) -->
  <line x1="47" y1="20" x2="47" y2="50" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="47" cy="34" r="3.5" stroke="currentColor" stroke-width="1.2" fill="none"/>
  <rect x="44.5" y="18" width="5" height="4" rx="2.5" stroke="currentColor" stroke-width="1" fill="none"/>
  <rect x="44.5" y="48" width="5" height="4" rx="2.5" stroke="currentColor" stroke-width="1" fill="none"/>

  <!-- Scroll parchment body -->
  <rect x="20" y="25" width="24" height="18" rx="1.5" stroke="currentColor" stroke-width="1.2" fill="none"/>
  <!-- Curved scroll edges (unrolled parchment effect) -->
  <path d="M20 25 Q32 22 44 25" stroke="currentColor" stroke-width="0.8" fill="none"/>
  <path d="M20 43 Q32 46 44 43" stroke="currentColor" stroke-width="0.8" fill="none"/>

  <!-- Text lines on scroll — two columns -->
  <line x1="23" y1="29" x2="30" y2="29" stroke="currentColor" stroke-width="0.7" opacity="0.7"/>
  <line x1="23" y1="32" x2="30" y2="32" stroke="currentColor" stroke-width="0.7" opacity="0.7"/>
  <line x1="23" y1="35" x2="30" y2="35" stroke="currentColor" stroke-width="0.7" opacity="0.7"/>
  <line x1="23" y1="38" x2="28" y2="38" stroke="currentColor" stroke-width="0.7" opacity="0.7"/>
  <line x1="34" y1="29" x2="41" y2="29" stroke="currentColor" stroke-width="0.7" opacity="0.7"/>
  <line x1="34" y1="32" x2="41" y2="32" stroke="currentColor" stroke-width="0.7" opacity="0.7"/>
  <line x1="34" y1="35" x2="41" y2="35" stroke="currentColor" stroke-width="0.7" opacity="0.7"/>
  <line x1="34" y1="38" x2="39" y2="38" stroke="currentColor" stroke-width="0.7" opacity="0.7"/>

  <!-- Olive branches — left side -->
  <path d="M14 22 C10 19 9 15 12 13" stroke="currentColor" stroke-width="0.9" fill="none" stroke-linecap="round"/>
  <ellipse cx="10.5" cy="18" rx="2.5" ry="1.2" transform="rotate(35 10.5 18)" stroke="currentColor" stroke-width="0.7" fill="none"/>
  <ellipse cx="12" cy="13.5" rx="2.5" ry="1.2" transform="rotate(55 12 13.5)" stroke="currentColor" stroke-width="0.7" fill="none"/>
  <path d="M14 26 C10 24 9 20 11 18" stroke="currentColor" stroke-width="0.9" fill="none" stroke-linecap="round"/>
  <ellipse cx="10" cy="22.5" rx="2.2" ry="1.1" transform="rotate(25 10 22.5)" stroke="currentColor" stroke-width="0.7" fill="none"/>

  <!-- Olive branches — right side -->
  <path d="M50 22 C54 19 55 15 52 13" stroke="currentColor" stroke-width="0.9" fill="none" stroke-linecap="round"/>
  <ellipse cx="53.5" cy="18" rx="2.5" ry="1.2" transform="rotate(-35 53.5 18)" stroke="currentColor" stroke-width="0.7" fill="none"/>
  <ellipse cx="52" cy="13.5" rx="2.5" ry="1.2" transform="rotate(-55 52 13.5)" stroke="currentColor" stroke-width="0.7" fill="none"/>
  <path d="M50 26 C54 24 55 20 53 18" stroke="currentColor" stroke-width="0.9" fill="none" stroke-linecap="round"/>
  <ellipse cx="54" cy="22.5" rx="2.2" ry="1.1" transform="rotate(-25 54 22.5)" stroke="currentColor" stroke-width="0.7" fill="none"/>
</svg>
