# Home page

- Home sections render inside HomeSlot.tsx (remembers each section's height per screen width) and keep loaded content via useHomeState in src/lib/homeMemory.ts; the hero keeps one height for all slides; the page waits for layout/feature switches before drawing — why: nothing on the home page may jump, pop in or vanish while scrolling.
