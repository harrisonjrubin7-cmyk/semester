A row in Privacy › Device for one capability (camera, microphone, location, notifications…). State is glyph + word. Blocked rows explain the device-settings path instead of offering a toggle.

```jsx
<PermissionRow capability="Location" use="Campus map and event check-in" state="limited" detail="Approximate · only while using the app" onChange={edit} />
```
