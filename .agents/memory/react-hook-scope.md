---
name: React hook scope in split components
description: Hooks called in a parent component are not available in a sibling or separately-defined child component — even if they are in the same file.
---

## Rule

If a file exports a default component that renders a child component (defined as a separate function in the same file), a hook called in the parent is **not in scope** in the child. TypeScript will report "Cannot find name 'X'" even though the variable appears to be in the same file.

**Why:** Each function component is its own closure. Variables (including hook return values) do not leak between sibling or parent-child component definitions.

## How to apply

Always call the hook **inside the component function that renders the value**.

```tsx
// WRONG — org is in EventQrPage but used in QrDisplay
function EventQrPage() {
  const { data: org } = useGetOrgSettings(); // defined here
  return <QrDisplay />;
}
function QrDisplay() {
  return <p>{org?.chapterName}</p>; // TS error: Cannot find name 'org'
}

// CORRECT — hook inside the component that uses the value
function QrDisplay() {
  const { data: org } = useGetOrgSettings(); // defined here
  return <p>{org?.chapterName}</p>; // works
}
```

React Query deduplicates requests by query key, so calling the same hook in multiple components costs nothing extra in network requests.
