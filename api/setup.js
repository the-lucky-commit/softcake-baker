export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ info: 'POST to this endpoint to set up Messenger Profile (persistent menu + ice breakers).' });
  }

  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
  if (!PAGE_ACCESS_TOKEN) return res.status(500).json({ error: 'Missing PAGE_ACCESS_TOKEN' });

  const setupData = {
    "get_started": {
      "payload": "MAIN_MENU"
    },
    "persistent_menu": [
      {
        "locale": "default",
        "composer_input_disabled": false,
        "call_to_actions": [
          { "type": "postback", "title": "🍰 Our Soft Cakes", "payload": "INTERESTED_SOFTCAKE" },
          { "type": "postback", "title": "🛒 Order Now", "payload": "ORDER_MENU" },
          { "type": "postback", "title": "📞 Contact Admin", "payload": "CONTACT_ADMIN" }
        ]
      }
    ],
    "ice_breakers": [
      {
        "call_to_actions": [
          { "question": "I'm interested in Mini Soft Cake! 🍰", "payload": "INTERESTED_SOFTCAKE" },
          { "question": "I want to place an order 🛒", "payload": "ORDER_MENU" },
          { "question": "Contact Admin 📞", "payload": "CONTACT_ADMIN" }
        ],
        "locale": "default"
      }
    ]
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/v19.0/me/messenger_profile?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setupData)
      }
    );
    const data = await response.json();
    return res.status(200).json({ success: true, result: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
