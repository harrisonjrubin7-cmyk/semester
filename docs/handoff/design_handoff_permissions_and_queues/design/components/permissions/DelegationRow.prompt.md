Delegated or shared access granted by the student (guardian view, TA delegation). Lists exact scope items and an expiry; revoke takes effect immediately.

```jsx
<DelegationRow who="Maria Reyes" role="Parent" scope={['Billing balance','Holds']} expires="31 May 2027" onRevoke={revoke} />
```
