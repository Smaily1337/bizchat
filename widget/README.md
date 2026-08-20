# BizChat WWW Widget

Embeddable chat bubble talking to `POST /webhooks/widget/session` and `POST /webhooks/widget`.

## Demo

1. Start backend on `:8000` and seed DB.
2. Open `widget/index.html` in a browser (or serve the folder).
3. Paste `business_id` from admin → Kanały (or seed output).
4. Chat: try „jakie są godziny otwarcia?” or „umów wizytę”.

## Embed snippet

```html
<script
  src="https://YOUR_HOST/widget/bizchat-widget.js"
  data-api="https://api.yourdomain.com"
  data-business-id="YOUR_BUSINESS_UUID"
></script>
```

Or programmatically:

```js
BizChatWidget.mount({
  apiBase: "https://api.yourdomain.com",
  businessId: "YOUR_BUSINESS_UUID",
  name: "Gość",
});
```

CORS must include the page origin in `CORS_ORIGINS`.
