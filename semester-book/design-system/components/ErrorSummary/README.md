Summary of form errors at the top of a form (WCAG 3.3.1). Each item links to and focuses its field by id. Move focus to the summary on failed submit.

```jsx
<ErrorSummary ref={r} errors={[{ field: "email", message: "Enter a full email address" }]} />
```
