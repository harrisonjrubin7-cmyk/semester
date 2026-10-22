The universal page head from the UI grammar: kicker, one H1, one line on what the page helps you do, source/freshness, and at most one primary action.

```jsx
<PageHeader kicker="Plan" title="Registration readiness" purpose="Check you can register when your window opens." source={<SourceBadge source="official" updated="2 h ago" />} actions={<Button variant="primary">Review hold</Button>} />
```
