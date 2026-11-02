Pre-prompt shown by Semester *before* the operating system's permission dialog. Always states why, when, the fallback if declined, and what is kept. "Not now" never blocks the task.

```jsx
<PermissionPrompt capability="camera" why="Scan a textbook ISBN to fill in your listing." when="Only while you're on this screen." fallback="Type the ISBN instead." kept="Nothing. The image stays on your device." onAllow={ask} onNotNow={skip} />
```
