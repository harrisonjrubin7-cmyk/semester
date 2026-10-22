A determinate wait (upload, import) with real <progress>, percentage in words, Cancel/Retry.

```jsx
<ProgressState label="Importing transcript" done={64} total={100} note="Only your institution and you can see this file." />
```

`failed` swaps the bar for the reason + Retry.
